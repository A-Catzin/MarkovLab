"""
    PostgresUserRepository(url)

Adaptador de usuarios sobre PostgreSQL (tabla `usuarios`, con nombres en español). `url`
es la cadena de conexión (`DATABASE_URL`) con la forma `postgresql://usuario:clave@host:puerto/base`;
cualquier otra forma se rechaza con `ArgumentError` sin repetir la URL, que contiene la
contraseña. La conexión se abre en el primer uso y se vuelve a abrir si se cae. Un candado serializa las consultas, porque una conexión de
LibPQ no se puede usar desde dos tareas a la vez.
"""
# Esquema postgresql:// o postgres:// al inicio y sin espacios. Un prefijo duplicado
# ("postgresql:postgresql://") no empieza con "://" y queda rechazado.
const DATABASE_URL_PATTERN = r"^postgres(?:ql)?://[^\s]+$"

mutable struct PostgresUserRepository <: UserRepository
    url::String
    conn::Union{Nothing,LibPQ.Connection}
    lock::ReentrantLock

    function PostgresUserRepository(url::AbstractString)
        occursin(DATABASE_URL_PATTERN, url) ||
            throw(ArgumentError("database url must look like postgresql://user:password@host:port/database"))
        return new(String(url), nothing, ReentrantLock())
    end
end

"""
    connection!(users::PostgresUserRepository) -> LibPQ.Connection

Devuelve la conexión abierta, o abre una nueva si no existe o se cayó.
"""
function connection!(users::PostgresUserRepository)
    lock(users.lock) do
        conn = users.conn
        if conn === nothing || LibPQ.status(conn) != LibPQ.libpq_c.CONNECTION_OK
            conn === nothing || close(conn)
            users.conn = LibPQ.Connection(users.url; throw_error=true)
        end
        return users.conn
    end
end

function Base.close(users::PostgresUserRepository)
    lock(users.lock) do
        users.conn === nothing || close(users.conn)
        users.conn = nothing
    end
    return nothing
end

# Crea el usuario o, si ya existe uno con el mismo `google_sub`, actualiza su correo, su
# nombre y la fecha de actualización. El id y las fechas se envían explícitos para no depender
# de los valores por defecto ni de los triggers de la tabla. Si la tabla tiene un índice único
# sobre el correo, un correo de otra cuenta se rechaza con 23505 (EmailConflictError).
const UPSERT_GOOGLE_USER_SQL = """
    INSERT INTO usuarios (id, correo, nombre_visible, google_sub, creado_en, actualizado_en)
    VALUES (gen_random_uuid(), \$1, \$2, \$3, now(), now())
    ON CONFLICT (google_sub) DO UPDATE
        SET correo = EXCLUDED.correo, nombre_visible = EXCLUDED.nombre_visible, actualizado_en = now()
    RETURNING id::text AS id, correo AS email, nombre_visible AS display_name
    """

"""
    is_connection_error(err) -> Bool

Indica si `err` significa que la conexión se perdió: una falla del cliente o de la red
(sin respuesta SQL o sin código SQLSTATE, que es lo que llega cuando el servidor cortó
la conexión), un error de clase 08 o 57P01 (el servidor cerró la sesión). Los
errores de SQL, como una tabla que no existe, no se reintentan: fallarían igual.
"""
is_connection_error(err) =
    err isa LibPQ.Errors.LibPQException &&
    (!(err isa LibPQ.Errors.PQResultError) || err isa LibPQ.Errors.PQResultError{LibPQ.Errors.CUN} ||
     err isa LibPQ.Errors.PQResultError{LibPQ.Errors.C08} || err isa LibPQ.Errors.AdminShutdown)

function run_upsert(users::PostgresUserRepository, profile::GoogleProfile)
    return LibPQ.execute(connection!(users), UPSERT_GOOGLE_USER_SQL,
                         [profile.email, something(profile.name, missing), profile.subject];
                         throw_error=true)
end

function save_google_user(users::PostgresUserRepository, profile::GoogleProfile)
    lock(users.lock) do
        result = try
            run_upsert(users, profile)
        catch err
            err isa LibPQ.Errors.UniqueViolation && throw(EmailConflictError(profile.email))
            is_connection_error(err) || rethrow()
            # La conexión se cortó (reinicio de la base o cierre por inactividad):
            # LibPQ.status sigue diciendo CONNECTION_OK hasta que falla una consulta. Se
            # reconecta y se reintenta una vez; el upsert es idempotente, así que es seguro.
            close(users)
            try
                run_upsert(users, profile)
            catch retry_err
                retry_err isa LibPQ.Errors.UniqueViolation && throw(EmailConflictError(profile.email))
                rethrow()
            end
        end
        try
            row = LibPQ.columntable(result)
            name = only(row.display_name)
            return AppUser(only(row.id), only(row.email), ismissing(name) ? nothing : name)
        finally
            close(result)
        end
    end
end

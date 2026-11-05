"""
    PostgresUserRepository(url)

Adaptador de usuarios sobre PostgreSQL (tabla `usuarios`, con nombres en español). La
conexión, la validación de `url` y el reintento ante una conexión perdida los maneja
[`PostgresConnection`](@ref).
"""
struct PostgresUserRepository <: UserRepository
    db::PostgresConnection
end

PostgresUserRepository(url::AbstractString) = PostgresUserRepository(PostgresConnection(url))

connection!(users::PostgresUserRepository) = connection!(users.db)
Base.close(users::PostgresUserRepository) = close(users.db)

# Crea el usuario o, si ya existe uno con el mismo `google_sub`, actualiza su correo, su
# nombre y la fecha de actualización. El id y las fechas se envían explícitos para no depender
# de los valores por defecto ni de los triggers de la tabla. Si la tabla tiene un índice único
# sobre el correo, un correo de otra cuenta se rechaza con 23505 (EmailConflictError).
const UPSERT_GOOGLE_USER_SQL = """
    INSERT INTO usuarios (id, correo, nombre_visible, google_sub, creado_en, actualizado_en)
    VALUES (gen_random_uuid(), \$1, \$2, \$3, now(), now())
    ON CONFLICT (google_sub) DO UPDATE
        SET correo = EXCLUDED.correo, nombre_visible = EXCLUDED.nombre_visible, actualizado_en = now()
    RETURNING id::text AS id, correo AS email, nombre_visible AS display_name, rol::text AS rol
    """

# Columnas comunes para leer un usuario. El rol de la base ('usuario', 'admin') se
# traduce a los símbolos del dominio (:user, :admin).
const USER_COLUMNS = "id::text AS id, correo AS email, nombre_visible AS display_name, rol::text AS rol"
const ROLE_FROM_DB = Dict("usuario" => :user, "admin" => :admin)
const ROLE_TO_DB = Dict(:user => "usuario", :admin => "admin")

const FIND_USER_SQL = "SELECT $USER_COLUMNS FROM usuarios WHERE id = \$1::uuid"
const LIST_USERS_SQL = "SELECT $USER_COLUMNS FROM usuarios ORDER BY creado_en, correo"
# Bloquea las filas de los admins antes de contar: así dos cambios simultáneos no pueden
# dejar el sistema sin admins.
const LOCK_ADMINS_SQL = "SELECT id::text AS id FROM usuarios WHERE rol = 'admin' FOR UPDATE"
const SET_ROLE_SQL = """
    UPDATE usuarios SET rol = \$2::rol_usuario, actualizado_en = now()
    WHERE id = \$1::uuid
    RETURNING $USER_COLUMNS
    """

# Convierte las filas de un resultado en `AppUser` y cierra el resultado.
function users_from(result)
    try
        table = LibPQ.columntable(result)
        return [AppUser(table.id[i], table.email[i], ismissing(table.display_name[i]) ? nothing : table.display_name[i],
                        ROLE_FROM_DB[table.rol[i]]) for i in eachindex(table.id)]
    finally
        close(result)
    end
end

function save_google_user(users::PostgresUserRepository, profile::GoogleProfile)
    # El upsert es idempotente, así que se puede repetir si la conexión se había cortado.
    result = try
        with_connection(users.db) do conn
            LibPQ.execute(conn, UPSERT_GOOGLE_USER_SQL,
                          [profile.email, something(profile.name, missing), profile.subject];
                          throw_error=true)
        end
    catch err
        err isa LibPQ.Errors.UniqueViolation && throw(EmailConflictError(profile.email))
        rethrow()
    end
    return only(users_from(result))
end

function find_user(users::PostgresUserRepository, id)
    is_uuid(id) || return nothing
    found = with_connection(conn -> users_from(LibPQ.execute(conn, FIND_USER_SQL, [id]; throw_error=true)), users.db)
    return isempty(found) ? nothing : only(found)
end

list_users(users::PostgresUserRepository) =
    with_connection(conn -> users_from(LibPQ.execute(conn, LIST_USERS_SQL; throw_error=true)), users.db)

function set_user_role(users::PostgresUserRepository, id, role::Symbol; actor_id=nothing)
    role in USER_ROLES || throw(ArgumentError("role must be one of $(join(USER_ROLES, ", "))"))
    is_uuid(id) || return nothing
    return with_connection(users.db) do conn
        in_transaction(conn) do
            admin_ids = let result = LibPQ.execute(conn, LOCK_ADMINS_SQL; throw_error=true)
                try
                    collect(LibPQ.columntable(result).id)
                finally
                    close(result)
                end
            end
            # Con las filas de los admins ya bloqueadas, el actor debe seguir entre ellos: si otro
            # admin le quitó el rol un instante antes, este cambio ya no le corresponde.
            actor_id === nothing || lowercase(actor_id) in admin_ids || throw(ForbiddenError("admin role required"))
            role != :admin && lowercase(id) in admin_ids && length(admin_ids) <= 1 && throw(LastAdminError())
            updated = users_from(LibPQ.execute(conn, SET_ROLE_SQL, [id, ROLE_TO_DB[role]]; throw_error=true))
            isempty(updated) ? nothing : only(updated)
        end
    end
end

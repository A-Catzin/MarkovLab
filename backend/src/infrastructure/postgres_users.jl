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
    RETURNING id::text AS id, correo AS email, nombre_visible AS display_name
    """

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
    try
        row = LibPQ.columntable(result)
        name = only(row.display_name)
        return AppUser(only(row.id), only(row.email), ismissing(name) ? nothing : name)
    finally
        close(result)
    end
end

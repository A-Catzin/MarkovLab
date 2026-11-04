# Conexión compartida a PostgreSQL (Supabase) para los adaptadores de la base. Concentra
# la validación de la URL, la apertura perezosa, el candado y el reintento ante una
# conexión perdida, para que cada repositorio no los repita.

# Esquema postgresql:// o postgres:// al inicio y sin espacios. Un prefijo duplicado
# ("postgresql:postgresql://") no empieza con "://" y queda rechazado.
const DATABASE_URL_PATTERN = r"^postgres(?:ql)?://[^\s]+$"

"""
    PostgresConnection(url)

Conexión a PostgreSQL. `url` es la cadena de conexión (`DATABASE_URL`) con la forma
`postgresql://usuario:clave@host:puerto/base`; cualquier otra forma se rechaza con
`ArgumentError` sin repetir la URL, que contiene la contraseña. La conexión se abre en
el primer uso y se vuelve a abrir si se cae. Un candado serializa las consultas, porque
una conexión de LibPQ no se puede usar desde dos tareas a la vez.
"""
mutable struct PostgresConnection
    url::String
    conn::Union{Nothing,LibPQ.Connection}
    lock::ReentrantLock

    function PostgresConnection(url::AbstractString)
        occursin(DATABASE_URL_PATTERN, url) ||
            throw(ArgumentError("database url must look like postgresql://user:password@host:port/database"))
        return new(String(url), nothing, ReentrantLock())
    end
end

"""
    connection!(db::PostgresConnection) -> LibPQ.Connection

Devuelve la conexión abierta, o abre una nueva si no existe o se cayó.
"""
function connection!(db::PostgresConnection)
    lock(db.lock) do
        conn = db.conn
        if conn === nothing || LibPQ.status(conn) != LibPQ.libpq_c.CONNECTION_OK
            conn === nothing || close(conn)
            db.conn = LibPQ.Connection(db.url; throw_error=true)
        end
        return db.conn
    end
end

function Base.close(db::PostgresConnection)
    lock(db.lock) do
        db.conn === nothing || close(db.conn)
        db.conn = nothing
    end
    return nothing
end

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

"""
    with_connection(f, db::PostgresConnection)

Ejecuta `f(conn)` con el candado tomado. Si la conexión se había cortado (reinicio de la
base o cierre por inactividad; `LibPQ.status` sigue diciendo `CONNECTION_OK` hasta que
falla una consulta), reconecta y vuelve a ejecutar `f` una sola vez. Por eso `f` debe
poder repetirse sin efectos dobles: una sola consulta idempotente o una transacción
completa que se revierte si falla.
"""
function with_connection(f, db::PostgresConnection)
    lock(db.lock) do
        try
            return f(connection!(db))
        catch err
            is_connection_error(err) || rethrow()
            close(db)
            return f(connection!(db))
        end
    end
end

"""
    in_transaction(f, conn) -> resultado de f

Ejecuta `f()` entre `BEGIN` y `COMMIT`; si `f` falla, hace `ROLLBACK` y vuelve a lanzar
el error. El `ROLLBACK` puede fallar si la conexión se cortó; ese error se ignora.
"""
function in_transaction(f, conn::LibPQ.Connection)
    LibPQ.execute(conn, "BEGIN"; throw_error=true)
    try
        result = f()
        LibPQ.execute(conn, "COMMIT"; throw_error=true)
        return result
    catch
        try
            LibPQ.execute(conn, "ROLLBACK")
        catch
        end
        rethrow()
    end
end

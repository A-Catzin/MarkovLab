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

# Parámetros de libpq para no esperar para siempre a un servidor que ya no está. El pooler de
# Supabase suelta conexiones inactivas sin avisar; sin esto, una consulta sobre esa conexión
# se queda esperando la respuesta (`PQexecParams` sin límite de tiempo) y, como la llamada
# bloquea el hilo, congela todo el servidor, incluido `/health` (visto el 2026-11-12).
# - keepalives: sondeo TCP tras 5 s sin tráfico, cada 5 s, 3 intentos: una conexión muerta
#   se detecta en unos 20 s, y el sondeo mantiene viva la ruta mientras está inactiva.
# - tcp_user_timeout: lo mismo cuando hay datos enviados sin confirmar (20 s). La libpq de
#   LibPQ.jl lo acepta pero no lo aplica al socket (comprobado el 2026-11-17 con getsockopt);
#   lo pone `set_user_timeout!`. Sin él, una consulta enviada después del corte reintentaba
#   para siempre: los keepalives solo actúan cuando no hay datos pendientes.
# - connect_timeout: abrir la conexión no tarda más de 10 s. LibPQ.jl conecta en modo no
#   bloqueante y no lee este valor de la URL; se le pasa también como argumento.
# Al detectarse, la consulta falla con un error de conexión y `with_connection` reconecta.
const USER_TIMEOUT_MS = 20_000
const CONNECT_TIMEOUT_SECONDS = 10
const CONNECTION_PARAMS = ("keepalives" => "1", "keepalives_idle" => "5", "keepalives_interval" => "5",
                           "keepalives_count" => "3", "tcp_user_timeout" => string(USER_TIMEOUT_MS),
                           "connect_timeout" => string(CONNECT_TIMEOUT_SECONDS))

# Constantes de Linux (netinet/tcp.h) para `setsockopt`.
const IPPROTO_TCP = Cint(6)
const TCP_USER_TIMEOUT = Cint(18)

"""
    set_user_timeout!(conn) -> Bool

Pone `TCP_USER_TIMEOUT` en el socket de `conn`: si hay datos enviados sin confirmar durante
`USER_TIMEOUT_MS`, el sistema cierra la conexión y la consulta falla. Solo existe en Linux,
donde corre el servidor; en otro sistema no hace nada y devuelve `false`. Si `setsockopt`
falla, lo avisa y devuelve `false`: la conexión sigue sirviendo, con los keepalives.
"""
function set_user_timeout!(conn::LibPQ.Connection)
    Sys.islinux() || return false
    fd = LibPQ.libpq_c.PQsocket(conn.conn)
    value = Ref{Cint}(USER_TIMEOUT_MS)
    ok = ccall(:setsockopt, Cint, (Cint, Cint, Cint, Ptr{Cint}, Cuint),
               fd, IPPROTO_TCP, TCP_USER_TIMEOUT, value, sizeof(Cint)) == 0
    ok || @warn "Could not set TCP_USER_TIMEOUT on the database socket" errno = Libc.errno()
    return ok
end

"""
    connection_url(url) -> String

Agrega a `url` los parámetros de [`CONNECTION_PARAMS`](@ref) que no traiga ya; los que la
URL define se respetan.
"""
function connection_url(url::AbstractString)
    query = occursin('?', url) ? split(url, '?'; limit=2)[2] : ""
    present = Set(first(split(pair, '=')) for pair in split(query, '&') if !isempty(pair))
    missing_params = ["$k=$v" for (k, v) in CONNECTION_PARAMS if !(k in present)]
    isempty(missing_params) && return String(url)
    return string(url, occursin('?', url) ? "&" : "?", join(missing_params, '&'))
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
            conn = LibPQ.Connection(connection_url(db.url); throw_error=true,
                                    connect_timeout=CONNECT_TIMEOUT_SECONDS)
            set_user_timeout!(conn)
            db.conn = conn
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
    run_query(conn, sql, params=[]) -> LibPQ.Result

Ejecuta una consulta sin bloquear el hilo. `LibPQ.execute` es una llamada a C que deja el
hilo esperando la respuesta, y mientras tanto el servidor no atiende ninguna otra petición,
ni siquiera `/health`. `async_execute` envía la consulta y espera el socket cediendo el
hilo a las demás tareas.

Un error sale como el error de LibPQ, no envuelto en el `TaskFailedException` o el
`CompositeException` de las tareas de `async_execute`, para que `is_connection_error` lo
siga reconociendo y `with_connection` pueda reconectar. Todas las consultas de los
adaptadores pasan por aquí.
"""
function run_query(conn::LibPQ.Connection, sql::AbstractString, params::AbstractVector=Any[])
    try
        return fetch(LibPQ.async_execute(conn, sql, params; throw_error=true))
    catch err
        inner = unwrap_task_error(err)
        inner === err ? rethrow() : throw(inner)
    end
end

"""
    unwrap_task_error(err) -> Exception

El error original dentro de los envoltorios de tareas: `TaskFailedException` (de `fetch`)
y `CompositeException` con un solo error (de `@sync`), en cualquier orden y anidados.
"""
function unwrap_task_error(err)
    while true
        if err isa TaskFailedException
            err = err.task.exception
        elseif err isa CompositeException && length(err.exceptions) == 1
            err = only(err.exceptions)
        else
            return err
        end
    end
end

"""
    in_transaction(f, conn) -> resultado de f

Ejecuta `f()` entre `BEGIN` y `COMMIT`; si `f` falla, hace `ROLLBACK` y vuelve a lanzar
el error. El `ROLLBACK` puede fallar si la conexión se cortó; ese error se ignora.
"""
function in_transaction(f, conn::LibPQ.Connection)
    run_query(conn, "BEGIN")
    try
        result = f()
        run_query(conn, "COMMIT")
        return result
    catch
        try
            run_query(conn, "ROLLBACK")
        catch
        end
        rethrow()
    end
end

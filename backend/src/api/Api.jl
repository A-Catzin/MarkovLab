"""
Transporte HTTP/JSON del backend (SRS 6.3). Las rutas traducen solicitudes en
llamadas a servicios y errores en respuestas JSON; nunca calculan reglas
financieras. El contrato está documentado en documentacion/tecnica/API.md.
"""
module Api

using Oxygen; @oxidize
using HTTP
import LibPQ
using ..MarkovLabBackend: MarkovLabBackend, InsufficientDataError, Portfolio, analyze_prices, run_monte_carlo,
                          DEFAULT_SIMULATIONS, DEFAULT_HORIZON, DEFAULT_CONFIDENCE,
                          GoogleProfile, EmailConflictError, UserRepository, PostgresUserRepository, sync_google_user

const SERVICE_NAME = "markovlab-backend"
const DEFAULT_ALLOWED_ORIGINS = "http://localhost:3000"
const MIN_INTERNAL_KEY_LENGTH = 32

# Dependencias de las rutas internas. Se fijan con `configure!` al iniciar (o en las pruebas).
const USERS = Ref{Union{Nothing,UserRepository}}(nothing)
const INTERNAL_KEY = Ref{String}("")

"""
    configure!(; users, internal_key)

Fija el repositorio de usuarios y la clave que deben enviar los llamados internos del
servidor de Next.js (`X-Internal-Key`). Con `internal_key` vacío, las rutas internas
responden 503.
"""
function configure!(; users::Union{Nothing,UserRepository}, internal_key::AbstractString)
    USERS[] = users
    INTERNAL_KEY[] = String(internal_key)
    return nothing
end

include("errors.jl")
include("cors.jl")
include("routes.jl")

"""
    start(; host, port, allowed_origins, async=false)

Inicia el servidor HTTP. Los valores por defecto vienen del entorno: `HOST`
(`0.0.0.0`), `PORT` (`8080`) y `ALLOWED_ORIGINS` (separados por comas; por
defecto `http://localhost:3000`).

Las rutas internas de usuarios usan además `DATABASE_URL` (PostgreSQL) e
`INTERNAL_API_KEY` (al menos 32 caracteres). Si falta alguna, el servidor arranca
igual y esas rutas responden 503.
"""
function start(; host::AbstractString=Base.get(ENV, "HOST", "0.0.0.0"),
               port::Integer=parse(Int, Base.get(ENV, "PORT", "8080")),
               allowed_origins::AbstractVector{<:AbstractString}=
                   parse_allowed_origins(Base.get(ENV, "ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)),
               async::Bool=false)
    database_url = strip(Base.get(ENV, "DATABASE_URL", ""))
    internal_key = strip(Base.get(ENV, "INTERNAL_API_KEY", ""))
    if !isempty(internal_key) && length(internal_key) < MIN_INTERNAL_KEY_LENGTH
        @warn "INTERNAL_API_KEY is shorter than $MIN_INTERNAL_KEY_LENGTH characters; internal routes stay disabled"
        internal_key = ""
    end
    users = nothing
    if !isempty(database_url)
        try
            users = PostgresUserRepository(database_url)
        catch err
            err isa ArgumentError || rethrow()
            # Se registra solo el motivo: la URL lleva la contraseña.
            @warn "DATABASE_URL is invalid; user routes stay disabled" reason = err.msg
        end
    end
    configure!(users=users, internal_key=internal_key)
    # Abre la conexión en segundo plano al arrancar: así el primer inicio de sesión no paga
    # la conexión al pooler ni la compilación de LibPQ, y un problema de la base se ve enseguida.
    if users !== nothing
        Threads.@spawn try
            LibPQ.execute(MarkovLabBackend.connection!(users), "SELECT 1"; throw_error=true)
            @info "Database connection ready"
        catch err
            @warn "Could not connect to the database at startup" error_type = nameof(typeof(err))
        end
    end
    @info "Starting $SERVICE_NAME" host port allowed_origins database = users !== nothing internal_routes = !isempty(internal_key)
    return serve(; host, port, async, middleware=[cors_middleware(allowed_origins)])
end

end # módulo Api

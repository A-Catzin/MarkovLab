"""
Transporte HTTP/JSON del backend (SRS 6.3). Las rutas traducen solicitudes en
llamadas a servicios y errores en respuestas JSON; nunca calculan reglas
financieras. El contrato está documentado en documentacion/tecnica/API.md.
"""
module Api

using Oxygen; @oxidize
using HTTP
using ..MarkovLabBackend: MarkovLabBackend, InsufficientDataError, Portfolio, analyze_prices, run_monte_carlo,
                          DEFAULT_SIMULATIONS, DEFAULT_HORIZON, DEFAULT_CONFIDENCE

const SERVICE_NAME = "markovlab-backend"
const DEFAULT_ALLOWED_ORIGINS = "http://localhost:3000"

include("errors.jl")
include("cors.jl")
include("routes.jl")

"""
    start(; host, port, allowed_origins, async=false)

Inicia el servidor HTTP. Los valores por defecto vienen del entorno: `HOST`
(`0.0.0.0`), `PORT` (`8080`) y `ALLOWED_ORIGINS` (separados por comas; por
defecto `http://localhost:3000`).
"""
function start(; host::AbstractString=Base.get(ENV, "HOST", "0.0.0.0"),
               port::Integer=parse(Int, Base.get(ENV, "PORT", "8080")),
               allowed_origins::AbstractVector{<:AbstractString}=
                   parse_allowed_origins(Base.get(ENV, "ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)),
               async::Bool=false)
    @info "Starting $SERVICE_NAME" host port allowed_origins
    return serve(; host, port, async, middleware=[cors_middleware(allowed_origins)])
end

end # módulo Api

"""
HTTP/JSON transport of the backend (SRS 6.3). Routes translate requests into
service calls and errors into JSON responses; they never compute financial
rules. The contract is documented in documentacion/tecnica/API.md.
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

Starts the HTTP server. Defaults come from the environment: `HOST`
(`0.0.0.0`), `PORT` (`8080`) and `ALLOWED_ORIGINS` (comma-separated, default
`http://localhost:3000`).
"""
function start(; host::AbstractString=Base.get(ENV, "HOST", "0.0.0.0"),
               port::Integer=parse(Int, Base.get(ENV, "PORT", "8080")),
               allowed_origins::AbstractVector{<:AbstractString}=
                   parse_allowed_origins(Base.get(ENV, "ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)),
               async::Bool=false)
    @info "Starting $SERVICE_NAME" host port allowed_origins
    return serve(; host, port, async, middleware=[cors_middleware(allowed_origins)])
end

end # module Api

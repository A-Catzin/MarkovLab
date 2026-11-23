"""
Transporte HTTP/JSON del backend (SRS 6.3). Las rutas traducen solicitudes en
llamadas a servicios y errores en respuestas JSON; nunca calculan reglas
financieras. El contrato está documentado en documentacion/tecnica/API.md.
"""
module Api

using Oxygen; @oxidize
using HTTP
using Dates: Date, @dateformat_str, year
import LibPQ
using ..MarkovLabBackend: MarkovLabBackend, InsufficientDataError, MissingExchangeRateError, Portfolio, analyze_prices, run_monte_carlo,
                          DEFAULT_SIMULATIONS, DEFAULT_HORIZON, DEFAULT_CONFIDENCE,
                          GoogleProfile, EmailConflictError, UserRepository, PostgresUserRepository, sync_google_user,
                          PriceRepository, PostgresPriceRepository, AppUser, ForbiddenError, LastAdminError,
                          find_user, list_users, list_assets, list_imports, parse_role, require_admin,
                          change_user_role, admin_summary, PortfolioRepository, PostgresPortfolioRepository,
                          PositionDraft, PortfolioDraft, SavedPortfolio, AssetDetails, import_prices,
                          create_user_portfolio, list_user_portfolios, get_user_portfolio, delete_user_portfolio,
                          require_user, user_portfolio_history, SimulationRepository, SavedSimulation,
                          PostgresSimulationRepository, simulate_user_portfolio, list_user_simulations,
                          WatchlistRepository, PostgresWatchlist, watched_assets, follow_asset, unfollow_asset,
                          is_followed, price_history, queue_market_refresh!, analyze_assets

const SERVICE_NAME = "markovlab-backend"
const DEFAULT_ALLOWED_ORIGINS = "http://localhost:3000"
const MIN_INTERNAL_KEY_LENGTH = 32

# Dependencias de las rutas internas. Se fijan con `configure!` al iniciar (o en las pruebas).
const USERS = Ref{Union{Nothing,UserRepository}}(nothing)
const PRICES = Ref{Union{Nothing,PriceRepository}}(nothing)
const PORTFOLIOS = Ref{Union{Nothing,PortfolioRepository}}(nothing)
const SIMULATIONS = Ref{Union{Nothing,SimulationRepository}}(nothing)
const WATCHLIST = Ref{Union{Nothing,WatchlistRepository}}(nothing)
const REFRESH_ENABLED = Ref(false)
const INTERNAL_KEY = Ref{String}("")

"""
    configure!(; users, prices=nothing, portfolios=nothing, simulations=nothing, watchlist=nothing, refresh_enabled=false, internal_key)

Fija los repositorios de usuarios, precios y carteras, y la clave que deben enviar los
llamados internos del servidor de Next.js (`X-Internal-Key`). Con `internal_key` vacío,
las rutas internas responden 503; sin un repositorio, también las rutas que lo usan.
"""
function configure!(; users::Union{Nothing,UserRepository}, prices::Union{Nothing,PriceRepository}=nothing,
                    portfolios::Union{Nothing,PortfolioRepository}=nothing,
                    simulations::Union{Nothing,SimulationRepository}=nothing,
                    watchlist::Union{Nothing,WatchlistRepository}=nothing, refresh_enabled::Bool=false,
                    internal_key::AbstractString)
    USERS[] = users
    PRICES[] = prices
    PORTFOLIOS[] = portfolios
    SIMULATIONS[] = simulations
    WATCHLIST[] = watchlist
    REFRESH_ENABLED[] = refresh_enabled
    INTERNAL_KEY[] = String(internal_key)
    return nothing
end

include("errors.jl")
include("cors.jl")
include("routes.jl")
include("watchlist.jl")
include("asset_analysis.jl")

"""
    warm_database(users, prices, portfolios, simulations)

Corre una vez las lecturas de cada repositorio de PostgreSQL al arrancar, para que la
primera petición real no pague su compilación (la precompilación de `precompile.jl` usa
repositorios en memoria y no llega a estos adaptadores). Solo lee: un usuario y una
cartera que no existen, el catálogo, la historia de un activo y el tipo de cambio del peso.
"""
function warm_database(users, prices, portfolios, simulations)
    nobody = "00000000-0000-4000-8000-000000000000"
    MarkovLabBackend.find_user(users, nobody)
    if prices !== nothing
        assets = MarkovLabBackend.list_assets(prices)
        isempty(assets) || MarkovLabBackend.price_history(prices, first(assets).id)
        MarkovLabBackend.exchange_rates(prices, "MXN")
    end
    if portfolios !== nothing
        MarkovLabBackend.list_portfolios(portfolios, nobody)
        MarkovLabBackend.get_portfolio(portfolios, nobody, nobody)
    end
    simulations === nothing || MarkovLabBackend.list_simulations(simulations, nobody, nobody)
    return nothing
end

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
    prices = nothing
    portfolios = nothing
    simulations = nothing
    watchlist = nothing
    if !isempty(database_url)
        try
            users = PostgresUserRepository(database_url)
            prices = PostgresPriceRepository(database_url)
            portfolios = PostgresPortfolioRepository(database_url)
            simulations = PostgresSimulationRepository(database_url)
            watchlist = PostgresWatchlist(prices.db)
        catch err
            err isa ArgumentError || rethrow()
            # Se registra solo el motivo: la URL lleva la contraseña.
            @warn "DATABASE_URL is invalid; user routes stay disabled" reason = err.msg
        end
    end
    configure!(users=users, prices=prices, portfolios=portfolios, simulations=simulations,
               watchlist=watchlist, refresh_enabled=Base.get(ENV, "MARKET_REFRESH_REQUESTS_ENABLED", "") == "true",
               internal_key=internal_key)
    # Abre la conexión en segundo plano al arrancar: así el primer inicio de sesión no paga
    # la conexión al pooler ni la compilación de LibPQ, y un problema de la base se ve enseguida.
    if users !== nothing
        Threads.@spawn try
            # Con el candado de la conexión, como toda consulta: así no cae dentro de la
            # transacción de una petición que llegue mientras arranca.
            MarkovLabBackend.with_connection(conn -> MarkovLabBackend.run_query(conn, "SELECT 1"), users.db)
            @info "Database connection ready"
            warm_database(users, prices, portfolios, simulations)
            @info "Database routes warmed up"
        catch err
            @warn "Could not connect to the database at startup" error_type = nameof(typeof(err))
        end
    end
    @info "Starting $SERVICE_NAME" host port allowed_origins database = users !== nothing internal_routes = !isempty(internal_key)
    return serve(; host, port, async, middleware=[cors_middleware(allowed_origins)])
end

end # módulo Api

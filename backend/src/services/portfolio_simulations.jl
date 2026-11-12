# Caso de uso: simular una cartera guardada con los precios de la base (RF-41 a RF-44) y
# guardar el resultado (RF-47). Usa el mismo Monte Carlo que POST /api/risk/monte-carlo.

"""Años de precios con que se estiman rendimientos y covarianzas, por defecto."""
const DEFAULT_LOOKBACK_YEARS = 5
const MAX_LOOKBACK_YEARS = 20
"""Días mínimos con precio de todos los activos para estimar (unos tres meses hábiles)."""
const MIN_SIMULATION_DAYS = 60

"""
    simulate_user_portfolio(users, portfolios, prices, simulations, actor_id, id;
                            horizon, simulations=DEFAULT_SIMULATIONS, confidence=DEFAULT_CONFIDENCE,
                            lookback_years=DEFAULT_LOOKBACK_YEARS, seed=nothing)
        -> Union{Nothing,SavedSimulation}

Simula la cartera `id` del actor con [`run_monte_carlo`](@ref) y guarda el resultado.

- **Precios:** el cierre ajustado diario de cada activo ([`price_history`](@ref)), solo los
  días en que todos cotizaron ([`aligned_prices`](@ref)), en los últimos `lookback_years`
  años contados desde el último día en común. Hacen falta al menos
  [`MIN_SIMULATION_DAYS`](@ref).
- **Horizonte** en días hábiles (21 ≈ un mes, 252 ≈ un año).
- Devuelve `nothing` si la cartera no existe o es de otro usuario.

Lanza `ArgumentError` si un parámetro está fuera de rango (`lookback_years` entre 1 y
[`MAX_LOOKBACK_YEARS`](@ref), y los límites de `run_monte_carlo`) e
`InsufficientDataError` si no hay suficientes precios.
"""
function simulate_user_portfolio(users::UserRepository, portfolios::PortfolioRepository, prices::PriceRepository,
                                 repository::SimulationRepository, actor_id, id; horizon::Integer,
                                 simulations::Integer=DEFAULT_SIMULATIONS, confidence::Real=DEFAULT_CONFIDENCE,
                                 lookback_years::Integer=DEFAULT_LOOKBACK_YEARS, seed::Union{Nothing,Integer}=nothing)
    user = require_user(users, actor_id)
    1 <= lookback_years <= MAX_LOOKBACK_YEARS ||
        throw(ArgumentError("lookback_years must be between 1 and $MAX_LOOKBACK_YEARS, got $lookback_years"))
    portfolio = get_portfolio(portfolios, user.id, id)
    portfolio === nothing && return nothing

    series = [price_history(prices, position.asset_id) for position in portfolio.positions]
    everything = aligned_prices(series; from=typemin(Date), min_days=MIN_SIMULATION_DAYS)
    window = aligned_prices(series; from=last(everything.dates) - Year(lookback_years), min_days=MIN_SIMULATION_DAYS)
    symbols = [position.symbol for position in portfolio.positions]
    weights = [position.weight for position in portfolio.positions]
    result = run_monte_carlo(Portfolio(symbols, weights), window.prices; simulations, horizon, confidence, seed)
    summary = summary_dict(result.summary)
    draft = SavedSimulation("", portfolio.id, result.model, result.parameters.simulations, result.parameters.horizon,
                            result.parameters.confidence, result.parameters.seed, result.parameters.observations,
                            symbols, weights, (first(window.dates), last(window.dates)), result.expected_period_return,
                            result.expected_period_volatility, summary["value_at_risk"],
                            summary["conditional_value_at_risk"], summary, nothing)
    return save_simulation(repository, user.id, draft)
end

"""
    list_user_simulations(users, portfolios, simulations, actor_id, id; limit=20)
        -> Union{Nothing,Vector{SavedSimulation}}

Las simulaciones de la cartera `id` del actor, de la más nueva a la más vieja; `nothing` si
la cartera no existe o es de otro usuario.
"""
function list_user_simulations(users::UserRepository, portfolios::PortfolioRepository, simulations::SimulationRepository,
                               actor_id, id; limit::Integer=20)
    user = require_user(users, actor_id)
    get_portfolio(portfolios, user.id, id) === nothing && return nothing
    return list_simulations(simulations, user.id, id; limit)
end

# Caso de uso: riesgo Monte Carlo de una cartera a partir de precios históricos
# (RF-41 a RF-44, RF-47, RF-48). Valida los límites de la solicitud (RNF-05) y
# devuelve todos los parámetros necesarios para reproducir el resultado (RNF-16, RNF-17).

"""Identificador del modelo de simulación, que se guarda con cada resultado (RNF-17)."""
const MONTE_CARLO_MODEL = "normal-rebalanced-v1"
const DEFAULT_SIMULATIONS = 10_000
const DEFAULT_HORIZON = 1
const DEFAULT_CONFIDENCE = 0.95
"""Máximo de escenarios por solicitud, para acotar el tiempo de respuesta."""
const MAX_SIMULATIONS = 100_000
"""Máximo del horizonte en períodos (unos 10 años de días hábiles)."""
const MAX_HORIZON = 2_520

"""
    run_monte_carlo(portfolio, prices; simulations, horizon, confidence, seed) -> NamedTuple

Estima rendimientos esperados y covarianza a partir de `prices` (una serie ordenada
de precios por activo de la cartera, en el mismo orden que `portfolio.symbols` y
alineadas por fecha), simula la cartera y resume los resultados.

Devuelve `parameters` (symbols, weights, simulations, horizon, confidence, seed,
observations), `model`, `expected_period_return`, `expected_period_volatility`
y `summary` (ver `summarize_outcomes`). Si `seed` es `nothing`, se genera una
semilla aleatoria y se informa, para que la ejecución pueda reproducirse.
"""
function run_monte_carlo(portfolio::Portfolio, prices::AbstractVector{<:AbstractVector{<:Real}};
                         simulations::Integer=DEFAULT_SIMULATIONS, horizon::Integer=DEFAULT_HORIZON,
                         confidence::Real=DEFAULT_CONFIDENCE, seed::Union{Nothing,Integer}=nothing)
    assets = length(portfolio.symbols)
    length(prices) == assets ||
        throw(ArgumentError("expected one price series per asset ($assets), got $(length(prices))"))
    observations = length(first(prices))
    all(series -> length(series) == observations, prices) ||
        throw(ArgumentError("all price series must have the same length (aligned by date)"))
    1 <= simulations <= MAX_SIMULATIONS ||
        throw(ArgumentError("simulations must be between 1 and $MAX_SIMULATIONS, got $simulations"))
    1 <= horizon <= MAX_HORIZON ||
        throw(ArgumentError("horizon must be between 1 and $MAX_HORIZON periods, got $horizon"))
    validate_confidence(confidence)

    returns = reduce(hcat, [simple_returns(series) for series in prices])
    covariance = covariance_matrix(returns)
    means = [mean_return(view(returns, :, j)) for j in 1:assets]
    used_seed = seed === nothing ? Int(rand(Random.RandomDevice(), UInt32)) : Int(seed)
    outcomes = simulate_portfolio_returns(portfolio, means, covariance;
                                          simulations, horizon, seed=used_seed)
    return (parameters=(symbols=portfolio.symbols, weights=portfolio.weights, simulations=Int(simulations),
                        horizon=Int(horizon), confidence=Float64(confidence), seed=used_seed,
                        observations=observations),
            model=MONTE_CARLO_MODEL,
            expected_period_return=portfolio_return(portfolio, means),
            expected_period_volatility=portfolio_volatility(portfolio, covariance),
            summary=summarize_outcomes(outcomes; confidence))
end

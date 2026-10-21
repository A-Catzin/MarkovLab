# Use case: Monte Carlo risk of a portfolio from historical prices (RF-41 to
# RF-44, RF-47, RF-48). Validates request limits (RNF-05) and returns every
# parameter needed to reproduce the result (RNF-16, RNF-17).

"""Identifier of the simulation model, stored with each result (RNF-17)."""
const MONTE_CARLO_MODEL = "normal-rebalanced-v1"
const DEFAULT_SIMULATIONS = 10_000
const DEFAULT_HORIZON = 1
const DEFAULT_CONFIDENCE = 0.95
"""Upper bound on scenarios per request, to keep response times bounded."""
const MAX_SIMULATIONS = 100_000
"""Upper bound on the horizon in periods (about 10 years of trading days)."""
const MAX_HORIZON = 2_520

"""
    run_monte_carlo(portfolio, prices; simulations, horizon, confidence, seed) -> NamedTuple

Estimates expected returns and covariance from `prices` (one ordered price
series per portfolio asset, same order as `portfolio.symbols`, all aligned by
date), simulates the portfolio and summarizes the outcomes.

Returns `parameters` (symbols, weights, simulations, horizon, confidence, seed,
observations), `model`, `expected_period_return`, `expected_period_volatility`
and `summary` (see `summarize_outcomes`). When `seed` is `nothing`, a random
seed is drawn and reported so that the run can be reproduced.
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

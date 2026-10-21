# Monte Carlo simulation of portfolio outcomes and tail-risk measures
# (RF-41 to RF-44, RF-48). Outcomes are returns over the whole horizon, expressed
# as fractions. Formulas are documented in documentacion/tecnica/SIMULACION_RIESGO.md.

const SUMMARY_PERCENTILES = (1, 5, 25, 50, 75, 95, 99)

function validate_confidence(confidence::Real)
    (isfinite(confidence) && 0 < confidence < 1) ||
        throw(ArgumentError("confidence must be strictly between 0 and 1, got $confidence"))
    return nothing
end

"""
    empirical_quantile(values, p) -> Float64

Empirical quantile with linear interpolation between order statistics
(Hyndman–Fan type 7, the default of most statistics packages). `p` must be in [0, 1].
"""
function empirical_quantile(values::AbstractVector{<:Real}, p::Real)
    require_observations(values, 1, "empirical_quantile")
    0 <= p <= 1 || throw(ArgumentError("quantile probability must be between 0 and 1, got $p"))
    validate_finite(values, "value")
    sorted = sort(values)
    h = (length(sorted) - 1) * p + 1
    lower = floor(Int, h)
    lower >= length(sorted) && return Float64(sorted[end])
    return sorted[lower] + (h - lower) * (sorted[lower + 1] - sorted[lower])
end

"""
    value_at_risk(outcomes; confidence=0.95) -> Float64

Historical/simulated Value at Risk: the loss not exceeded with probability
`confidence`, `VaR = -q_(1 - confidence)(outcomes)`. A positive value is a loss
(0.08 means an 8 % loss); a negative value means even the tail is a gain (RF-44).
"""
function value_at_risk(outcomes::AbstractVector{<:Real}; confidence::Real=0.95)
    validate_confidence(confidence)
    return -empirical_quantile(outcomes, 1 - confidence)
end

"""
    conditional_value_at_risk(outcomes; confidence=0.95) -> Float64

Conditional VaR (expected shortfall): the average loss of the outcomes at or
below the VaR threshold. Always greater than or equal to `value_at_risk` (RF-44).
"""
function conditional_value_at_risk(outcomes::AbstractVector{<:Real}; confidence::Real=0.95)
    validate_confidence(confidence)
    threshold = empirical_quantile(outcomes, 1 - confidence)
    tail = [o for o in outcomes if o <= threshold]
    return -sample_mean(tail)
end

"""
    summarize_outcomes(outcomes; confidence=0.95) -> NamedTuple

Summary of a simulated distribution (RF-48): `scenarios`, `mean`, `worst`,
`best`, `percentiles` (`Dict` from percentile to value for 1, 5, 25, 50, 75, 95
and 99), `confidence`, `value_at_risk` and `conditional_value_at_risk`.
"""
function summarize_outcomes(outcomes::AbstractVector{<:Real}; confidence::Real=0.95)
    validate_confidence(confidence)
    require_observations(outcomes, 1, "summarize_outcomes")
    validate_finite(outcomes, "outcome")
    percentiles = Dict(p => empirical_quantile(outcomes, p / 100) for p in SUMMARY_PERCENTILES)
    return (scenarios=length(outcomes),
            mean=sample_mean(outcomes),
            worst=Float64(minimum(outcomes)),
            best=Float64(maximum(outcomes)),
            percentiles=percentiles,
            confidence=Float64(confidence),
            value_at_risk=value_at_risk(outcomes; confidence),
            conditional_value_at_risk=conditional_value_at_risk(outcomes; confidence))
end

"""
    simulate_portfolio_returns(weights, expected_returns, covariance;
                               simulations=10_000, horizon=1, seed=nothing) -> Vector{Float64}
    simulate_portfolio_returns(portfolio, expected_returns, covariance; ...)

Monte Carlo simulation of the portfolio return over `horizon` periods (RF-41 to
RF-43). Asset returns per period are assumed multivariate normal with mean
`expected_returns` and covariance `covariance`; the portfolio is rebalanced each
period, so its period return is normal with `μ_p = wᵀμ` and `σ_p = sqrt(wᵀΣw)`.
Each scenario compounds `horizon` period returns: `prod(1 + r_p,t) - 1`.

`expected_returns` and `covariance` must share the period of `horizon` (for
example daily data and a horizon in trading days). A fixed integer `seed` makes
the result reproducible (RNF-16).
"""
function simulate_portfolio_returns(weights::AbstractVector{<:Real}, expected_returns::AbstractVector{<:Real},
                                    covariance::AbstractMatrix{<:Real};
                                    simulations::Integer=10_000, horizon::Integer=1,
                                    seed::Union{Nothing,Integer}=nothing)
    simulations >= 1 || throw(ArgumentError("simulations must be at least 1, got $simulations"))
    horizon >= 1 || throw(ArgumentError("horizon must be at least 1 period, got $horizon"))
    mu = portfolio_return(weights, expected_returns)
    sigma = portfolio_volatility(weights, covariance)
    rng = seed === nothing ? Random.Xoshiro() : Random.Xoshiro(seed)
    outcomes = Vector{Float64}(undef, simulations)
    for s in 1:simulations
        growth = 1.0
        for _ in 1:horizon
            growth *= 1 + mu + sigma * randn(rng)
        end
        outcomes[s] = growth - 1
    end
    return outcomes
end

simulate_portfolio_returns(portfolio::Portfolio, expected_returns::AbstractVector{<:Real},
                           covariance::AbstractMatrix{<:Real}; kwargs...) =
    simulate_portfolio_returns(portfolio.weights, expected_returns, covariance; kwargs...)

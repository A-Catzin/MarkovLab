# Simulación Monte Carlo de resultados de una cartera y medidas de riesgo de cola
# (RF-41 a RF-44, RF-48). Los resultados son rendimientos de todo el horizonte,
# expresados como fracciones. Fórmulas en documentacion/tecnica/SIMULACION_RIESGO.md.

const SUMMARY_PERCENTILES = (1, 5, 25, 50, 75, 95, 99)

function validate_confidence(confidence::Real)
    (isfinite(confidence) && 0 < confidence < 1) ||
        throw(ArgumentError("confidence must be strictly between 0 and 1, got $confidence"))
    return nothing
end

"""
    empirical_quantile(values, p) -> Float64

Cuantil empírico con interpolación lineal entre valores ordenados (tipo 7 de
Hyndman y Fan, el predeterminado de la mayoría de los paquetes estadísticos). `p` debe estar en [0, 1].
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

Valor en Riesgo histórico o simulado: la pérdida que no se supera con probabilidad
`confidence`, `VaR = -q_(1 - confidence)(outcomes)`. Un valor positivo es una pérdida
(0.08 significa 8 % de pérdida); uno negativo indica que incluso la cola es ganancia (RF-44).
"""
function value_at_risk(outcomes::AbstractVector{<:Real}; confidence::Real=0.95)
    validate_confidence(confidence)
    return -empirical_quantile(outcomes, 1 - confidence)
end

"""
    conditional_value_at_risk(outcomes; confidence=0.95) -> Float64

VaR condicional (pérdida esperada en la cola): la pérdida promedio de los resultados
iguales o peores que el umbral del VaR. Siempre es mayor o igual que `value_at_risk` (RF-44).
"""
function conditional_value_at_risk(outcomes::AbstractVector{<:Real}; confidence::Real=0.95)
    validate_confidence(confidence)
    threshold = empirical_quantile(outcomes, 1 - confidence)
    tail = [o for o in outcomes if o <= threshold]
    return -sample_mean(tail)
end

"""
    summarize_outcomes(outcomes; confidence=0.95) -> NamedTuple

Resumen de una distribución simulada (RF-48): `scenarios`, `mean`, `worst`,
`best`, `percentiles` (`Dict` de percentil a valor para 1, 5, 25, 50, 75, 95
y 99), `confidence`, `value_at_risk` y `conditional_value_at_risk`.
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

Simulación Monte Carlo del rendimiento de la cartera en `horizon` períodos (RF-41 a
RF-43). Se supone que los rendimientos de los activos por período siguen una normal
multivariada con media `expected_returns` y covarianza `covariance`; la cartera se
rebalancea en cada período, así que su rendimiento por período es normal con
`μ_p = wᵀμ` y `σ_p = sqrt(wᵀΣw)`. Cada escenario capitaliza `horizon` rendimientos:
`prod(1 + r_p,t) - 1`.

`expected_returns` y `covariance` deben estar en el mismo período que `horizon` (por
ejemplo, datos diarios y un horizonte en días hábiles). Una semilla entera fija
(`seed`) hace que el resultado sea reproducible (RNF-16).
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

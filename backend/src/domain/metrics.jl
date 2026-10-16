# Pure financial metrics over ordered price and return series (RF-15 to RF-17).
# Series are ordered from oldest to newest. Returns are expressed as fractions
# (0.05 means 5 %). Formulas are documented in documentacion/tecnica/METRICAS_DOMINIO.md.

function validate_prices(prices::AbstractVector{<:Real})
    for (i, price) in pairs(prices)
        (isfinite(price) && price > 0) ||
            throw(ArgumentError("price at position $i must be a finite positive number, got $price"))
    end
    return nothing
end

function validate_finite(values::AbstractVector{<:Real}, name::AbstractString)
    for (i, value) in pairs(values)
        isfinite(value) || throw(ArgumentError("$name at position $i must be finite, got $value"))
    end
    return nothing
end

sample_mean(values) = sum(values) / length(values)

function sample_std(values)
    m = sample_mean(values)
    return sqrt(sum(v -> (v - m)^2, values) / (length(values) - 1))
end

"""
    simple_returns(prices) -> Vector{Float64}

Period-over-period simple returns: `r_t = P_t / P_{t-1} - 1`.
Needs at least 2 finite positive prices.
"""
function simple_returns(prices::AbstractVector{<:Real})
    require_observations(prices, 2, "simple_returns")
    validate_prices(prices)
    return [prices[t] / prices[t - 1] - 1 for t in 2:length(prices)]
end

"""
    log_returns(prices) -> Vector{Float64}

Period-over-period logarithmic returns: `r_t = ln(P_t / P_{t-1})`.
Needs at least 2 finite positive prices.
"""
function log_returns(prices::AbstractVector{<:Real})
    require_observations(prices, 2, "log_returns")
    validate_prices(prices)
    return [log(prices[t] / prices[t - 1]) for t in 2:length(prices)]
end

"""
    cumulative_return(returns) -> Float64

Compounded return of a series of simple returns: `prod(1 + r_t) - 1`.
"""
function cumulative_return(returns::AbstractVector{<:Real})
    require_observations(returns, 1, "cumulative_return")
    validate_finite(returns, "return")
    return prod(1 .+ returns) - 1
end

"""
    mean_return(returns) -> Float64

Arithmetic mean of a return series.
"""
function mean_return(returns::AbstractVector{<:Real})
    require_observations(returns, 1, "mean_return")
    validate_finite(returns, "return")
    return sample_mean(returns)
end

"""
    volatility(returns; periods_per_year=nothing) -> Float64

Sample standard deviation (denominator `n - 1`) of a return series. When
`periods_per_year` is given (for example 252 for daily data), the result is
annualized by multiplying by `sqrt(periods_per_year)`.
"""
function volatility(returns::AbstractVector{<:Real}; periods_per_year::Union{Nothing,Real}=nothing)
    require_observations(returns, 2, "volatility")
    validate_finite(returns, "return")
    sigma = sample_std(returns)
    periods_per_year === nothing && return sigma
    periods_per_year > 0 || throw(ArgumentError("periods_per_year must be positive, got $periods_per_year"))
    return sigma * sqrt(periods_per_year)
end

"""
    drawdowns(prices) -> Vector{Float64}

Drawdown at each point relative to the running peak: `D_t = P_t / max(P_1..P_t) - 1`.
Values are zero at a new peak and negative below it.
"""
function drawdowns(prices::AbstractVector{<:Real})
    require_observations(prices, 1, "drawdowns")
    validate_prices(prices)
    peaks = accumulate(max, prices)
    return [prices[t] / peaks[t] - 1 for t in eachindex(prices)]
end

"""
    max_drawdown(prices) -> Float64

Worst drawdown of the series, as a non-positive fraction (-0.25 means a 25 % fall
from the previous peak). Needs at least 2 prices.
"""
function max_drawdown(prices::AbstractVector{<:Real})
    require_observations(prices, 2, "max_drawdown")
    return minimum(drawdowns(prices))
end

"""
    correlation(a, b) -> Float64

Pearson correlation between two return series of equal length (at least 2
observations). Throws `ArgumentError` if either series has zero variance,
because the correlation is undefined.
"""
function correlation(a::AbstractVector{<:Real}, b::AbstractVector{<:Real})
    length(a) == length(b) ||
        throw(ArgumentError("series must have the same length, got $(length(a)) and $(length(b))"))
    require_observations(a, 2, "correlation")
    validate_finite(a, "value")
    validate_finite(b, "value")
    ma, mb = sample_mean(a), sample_mean(b)
    da, db = a .- ma, b .- mb
    sa, sb = sqrt(sum(abs2, da)), sqrt(sum(abs2, db))
    (sa == 0 || sb == 0) && throw(ArgumentError("correlation is undefined for a series with zero variance"))
    return clamp(sum(da .* db) / (sa * sb), -1.0, 1.0)
end

"""
    correlation_matrix(returns) -> Matrix{Float64}

Pearson correlation matrix for a matrix whose rows are observations (dates) and
whose columns are assets. Needs at least 2 assets and 2 observations. The
result is symmetric with ones on the diagonal.
"""
function correlation_matrix(returns::AbstractMatrix{<:Real})
    observations, assets = size(returns)
    assets >= 2 || throw(ArgumentError("correlation_matrix requires at least 2 assets, got $assets"))
    require_observations(1:observations, 2, "correlation_matrix")
    matrix = Matrix{Float64}(undef, assets, assets)
    for i in 1:assets
        matrix[i, i] = 1.0
        for j in (i + 1):assets
            matrix[i, j] = matrix[j, i] = correlation(view(returns, :, i), view(returns, :, j))
        end
    end
    return matrix
end

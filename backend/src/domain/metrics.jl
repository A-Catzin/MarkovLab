# Métricas financieras puras sobre series ordenadas de precios y rendimientos (RF-15 a RF-17).
# Las series van de la observación más antigua a la más reciente. Los rendimientos se expresan
# como fracciones (0.05 equivale a 5 %). Fórmulas en documentacion/tecnica/METRICAS_DOMINIO.md.

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

Rendimientos simples entre períodos consecutivos: `r_t = P_t / P_{t-1} - 1`.
Requiere al menos 2 precios finitos y positivos.
"""
function simple_returns(prices::AbstractVector{<:Real})
    require_observations(prices, 2, "simple_returns")
    validate_prices(prices)
    return [prices[t] / prices[t - 1] - 1 for t in 2:length(prices)]
end

"""
    log_returns(prices) -> Vector{Float64}

Rendimientos logarítmicos entre períodos consecutivos: `r_t = ln(P_t / P_{t-1})`.
Requiere al menos 2 precios finitos y positivos.
"""
function log_returns(prices::AbstractVector{<:Real})
    require_observations(prices, 2, "log_returns")
    validate_prices(prices)
    return [log(prices[t] / prices[t - 1]) for t in 2:length(prices)]
end

"""
    cumulative_return(returns) -> Float64

Rendimiento compuesto de una serie de rendimientos simples: `prod(1 + r_t) - 1`.
"""
function cumulative_return(returns::AbstractVector{<:Real})
    require_observations(returns, 1, "cumulative_return")
    validate_finite(returns, "return")
    return prod(1 .+ returns) - 1
end

"""
    mean_return(returns) -> Float64

Media aritmética de una serie de rendimientos.
"""
function mean_return(returns::AbstractVector{<:Real})
    require_observations(returns, 1, "mean_return")
    validate_finite(returns, "return")
    return sample_mean(returns)
end

"""
    volatility(returns; periods_per_year=nothing) -> Float64

Desviación estándar muestral (denominador `n - 1`) de una serie de rendimientos.
Si se indica `periods_per_year` (por ejemplo 252 para datos diarios), el resultado
se anualiza multiplicándolo por `sqrt(periods_per_year)`.
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

Caída en cada punto respecto del máximo previo: `D_t = P_t / max(P_1..P_t) - 1`.
Vale cero en un nuevo máximo y es negativa por debajo de él.
"""
function drawdowns(prices::AbstractVector{<:Real})
    require_observations(prices, 1, "drawdowns")
    validate_prices(prices)
    peaks = accumulate(max, prices)
    return [prices[t] / peaks[t] - 1 for t in eachindex(prices)]
end

"""
    max_drawdown(prices) -> Float64

Peor caída de la serie, como fracción no positiva (-0.25 significa una caída de 25 %
desde el máximo previo). Requiere al menos 2 precios.
"""
function max_drawdown(prices::AbstractVector{<:Real})
    require_observations(prices, 2, "max_drawdown")
    return minimum(drawdowns(prices))
end

"""
    correlation(a, b) -> Float64

Correlación de Pearson entre dos series de rendimientos de igual longitud (al menos 2
observaciones). Lanza `ArgumentError` si alguna serie tiene varianza cero, porque
la correlación no está definida.
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

Matriz de correlación de Pearson para una matriz cuyas filas son observaciones (fechas)
y cuyas columnas son activos. Requiere al menos 2 activos y 2 observaciones. El
resultado es simétrico, con unos en la diagonal.
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

# Composición de carteras y su rendimiento y riesgo (RF-28 a RF-31).
# Las matrices de rendimientos tienen una fila por fecha y una columna por activo,
# en el mismo orden que los símbolos de la cartera. Fórmulas en
# documentacion/tecnica/CARTERAS_DOMINIO.md.

"""
Diferencia absoluta máxima permitida entre la suma de los pesos y 1.
"""
const PORTFOLIO_WEIGHT_TOLERANCE = 1e-6

"""
    Portfolio(symbols, weights)
    Portfolio(["AAPL" => 0.6, "MSFT" => 0.4])

Composición de activos sin posiciones cortas (RF-28, RF-29). El constructor
normaliza los símbolos (sin espacios, en mayúsculas) y exige:

- al menos un activo y tantos pesos como símbolos;
- símbolos no vacíos y únicos;
- pesos finitos entre 0 y 1;
- pesos que sumen 1 dentro de `PORTFOLIO_WEIGHT_TOLERANCE`.

Las violaciones lanzan `ArgumentError`. Los pesos se guardan tal como llegan, sin reescalar.
"""
struct Portfolio
    symbols::Vector{String}
    weights::Vector{Float64}

    function Portfolio(symbols::AbstractVector{<:AbstractString}, weights::AbstractVector{<:Real})
        isempty(symbols) && throw(ArgumentError("portfolio must contain at least one asset"))
        length(symbols) == length(weights) ||
            throw(ArgumentError("got $(length(symbols)) symbols but $(length(weights)) weights"))
        normalized = [String(uppercase(strip(symbol))) for symbol in symbols]
        any(isempty, normalized) && throw(ArgumentError("symbols must not be empty"))
        allunique(normalized) || throw(ArgumentError("symbols must be unique, got $(join(normalized, ", "))"))
        for (symbol, weight) in zip(normalized, weights)
            (isfinite(weight) && 0 <= weight <= 1) ||
                throw(ArgumentError("weight of $symbol must be between 0 and 1, got $weight"))
        end
        total = sum(weights)
        abs(total - 1) <= PORTFOLIO_WEIGHT_TOLERANCE ||
            throw(ArgumentError("weights must sum to 1 (100 %), got $total"))
        return new(normalized, Float64.(weights))
    end
end

Portfolio(allocation::AbstractVector{<:Pair}) = Portfolio([first(p) for p in allocation], [last(p) for p in allocation])

function require_matching_assets(weights, assets::Integer)
    length(weights) == assets ||
        throw(ArgumentError("got $(length(weights)) weights for $assets assets"))
    return nothing
end

"""
    covariance_matrix(returns; periods_per_year=nothing) -> Matrix{Float64}

Matriz de covarianza muestral (denominador `n - 1`) de una matriz de rendimientos con
una fila por fecha y una columna por activo. Requiere al menos 2 observaciones. Si
se indica `periods_per_year`, el resultado se anualiza multiplicándolo por ese valor.
"""
function covariance_matrix(returns::AbstractMatrix{<:Real}; periods_per_year::Union{Nothing,Real}=nothing)
    observations, assets = size(returns)
    require_observations(1:observations, 2, "covariance_matrix")
    validate_finite(vec(returns), "return")
    scale = 1.0
    if periods_per_year !== nothing
        periods_per_year > 0 || throw(ArgumentError("periods_per_year must be positive, got $periods_per_year"))
        scale = Float64(periods_per_year)
    end
    deviations = [returns[t, j] - sample_mean(view(returns, :, j)) for t in 1:observations, j in 1:assets]
    matrix = Matrix{Float64}(undef, assets, assets)
    for i in 1:assets, j in i:assets
        value = sum(deviations[t, i] * deviations[t, j] for t in 1:observations) / (observations - 1)
        matrix[i, j] = matrix[j, i] = value * scale
    end
    return matrix
end

"""
    portfolio_returns(weights, returns) -> Vector{Float64}
    portfolio_returns(portfolio, returns)

Serie histórica de rendimientos de una cartera rebalanceada en cada período:
`r_p,t = Σ_i w_i * r_i,t`. Las columnas de `returns` deben seguir el orden de los
pesos. El resultado puede pasarse a las demás métricas (`volatility`,
`cumulative_return`, ...).
"""
function portfolio_returns(weights::AbstractVector{<:Real}, returns::AbstractMatrix{<:Real})
    observations, assets = size(returns)
    require_matching_assets(weights, assets)
    require_observations(1:observations, 1, "portfolio_returns")
    return [sum(weights[j] * returns[t, j] for j in 1:assets) for t in 1:observations]
end

portfolio_returns(portfolio::Portfolio, returns::AbstractMatrix{<:Real}) =
    portfolio_returns(portfolio.weights, returns)

"""
    portfolio_return(weights, expected_returns) -> Float64
    portfolio_return(portfolio, expected_returns)

Rendimiento esperado de la cartera: `μ_p = Σ_i w_i * μ_i` (RF-30).
"""
function portfolio_return(weights::AbstractVector{<:Real}, expected_returns::AbstractVector{<:Real})
    require_matching_assets(weights, length(expected_returns))
    return sum(weights[i] * expected_returns[i] for i in eachindex(weights, expected_returns))
end

portfolio_return(portfolio::Portfolio, expected_returns::AbstractVector{<:Real}) =
    portfolio_return(portfolio.weights, expected_returns)

"""
    portfolio_volatility(weights, covariance) -> Float64
    portfolio_volatility(portfolio, covariance)

Volatilidad esperada de la cartera: `σ_p = sqrt(wᵀ Σ w)` (RF-30). `covariance` debe
ser una matriz cuadrada y simétrica del tamaño de los pesos; su período
(diario, anual, ...) define el período del resultado.
"""
function portfolio_volatility(weights::AbstractVector{<:Real}, covariance::AbstractMatrix{<:Real})
    rows, cols = size(covariance)
    rows == cols || throw(ArgumentError("covariance matrix must be square, got $rows×$cols"))
    require_matching_assets(weights, rows)
    for i in 1:rows, j in (i + 1):rows
        isapprox(covariance[i, j], covariance[j, i]; atol=1e-12) ||
            throw(ArgumentError("covariance matrix must be symmetric"))
    end
    variance = sum(weights[i] * covariance[i, j] * weights[j] for i in 1:rows, j in 1:rows)
    # El redondeo puede volver levemente negativa una varianza que vale cero.
    return sqrt(max(variance, 0.0))
end

portfolio_volatility(portfolio::Portfolio, covariance::AbstractMatrix{<:Real}) =
    portfolio_volatility(portfolio.weights, covariance)

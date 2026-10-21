# Portfolio allocation and portfolio-level risk/return (RF-28 to RF-31).
# Return matrices have one row per date and one column per asset, with columns
# in the same order as the portfolio symbols. Formulas are documented in
# documentacion/tecnica/CARTERAS_DOMINIO.md.

"""
Maximum absolute difference allowed between the sum of the weights and 1.
"""
const PORTFOLIO_WEIGHT_TOLERANCE = 1e-6

"""
    Portfolio(symbols, weights)
    Portfolio(["AAPL" => 0.6, "MSFT" => 0.4])

Long-only allocation of assets (RF-28, RF-29). The constructor normalizes the
symbols (trimmed, uppercase) and enforces:

- at least one asset and as many weights as symbols;
- non-empty, unique symbols;
- finite weights between 0 and 1;
- weights that sum to 1 within `PORTFOLIO_WEIGHT_TOLERANCE`.

Violations throw `ArgumentError`. Weights are stored as given, without rescaling.
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

Sample covariance matrix (denominator `n - 1`) of a returns matrix with one row
per date and one column per asset. Needs at least 2 observations. When
`periods_per_year` is given, the result is annualized by multiplying by it.
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

Historical return series of a portfolio rebalanced every period:
`r_p,t = Σ_i w_i * r_i,t`. Columns of `returns` must follow the order of the
weights. The result can be passed to the other metrics (`volatility`,
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

Expected portfolio return: `μ_p = Σ_i w_i * μ_i` (RF-30).
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

Expected portfolio volatility: `σ_p = sqrt(wᵀ Σ w)` (RF-30). `covariance` must
be a square, symmetric matrix matching the number of weights; its period
(daily, annual, ...) determines the period of the result.
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
    # Rounding can make a zero variance slightly negative.
    return sqrt(max(variance, 0.0))
end

portfolio_volatility(portfolio::Portfolio, covariance::AbstractMatrix{<:Real}) =
    portfolio_volatility(portfolio.weights, covariance)

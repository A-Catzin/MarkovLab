# Caso de uso: métricas principales de una serie de precios (RF-15, RF-16, RF-19, RF-20).

"""
    analyze_prices(prices; periods_per_year=nothing) -> NamedTuple

Calcula las métricas principales de una serie ordenada de precios: `observations`,
`cumulative_return`, `mean_return`, `volatility` (por período),
`annualized_volatility` (`nothing` salvo que se indique `periods_per_year`) y
`max_drawdown`. Requiere al menos 3 precios, para que la volatilidad tenga 2 rendimientos.
"""
function analyze_prices(prices::AbstractVector{<:Real}; periods_per_year::Union{Nothing,Real}=nothing)
    require_observations(prices, 3, "analyze_prices")
    returns = simple_returns(prices)
    return (observations=length(prices),
            cumulative_return=cumulative_return(returns),
            mean_return=mean_return(returns),
            volatility=volatility(returns),
            annualized_volatility=periods_per_year === nothing ? nothing :
                                  volatility(returns; periods_per_year),
            max_drawdown=max_drawdown(prices))
end

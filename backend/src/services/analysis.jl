# Use case: summary metrics of one price series (RF-15, RF-16, RF-19, RF-20).

"""
    analyze_prices(prices; periods_per_year=nothing) -> NamedTuple

Computes the main metrics of an ordered price series: `observations`,
`cumulative_return`, `mean_return`, `volatility` (per period),
`annualized_volatility` (`nothing` unless `periods_per_year` is given) and
`max_drawdown`. Needs at least 3 prices, so that the volatility has 2 returns.
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

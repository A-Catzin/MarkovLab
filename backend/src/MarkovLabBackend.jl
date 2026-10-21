module MarkovLabBackend

using Dates
import Random

include("domain/errors.jl")
include("domain/metrics.jl")
include("domain/prices.jl")
include("domain/portfolio.jl")
include("domain/simulation.jl")
include("infrastructure/csv_prices.jl")

export InsufficientDataError
export simple_returns, log_returns, cumulative_return, mean_return, volatility
export drawdowns, max_drawdown, correlation, correlation_matrix
export PriceBar
export Portfolio, PORTFOLIO_WEIGHT_TOLERANCE
export covariance_matrix, portfolio_returns, portfolio_return, portfolio_volatility
export empirical_quantile, value_at_risk, conditional_value_at_risk, summarize_outcomes
export simulate_portfolio_returns
export ImportIssue, PriceImportResult, parse_prices_csv, read_prices_csv

end # module MarkovLabBackend

module MarkovLabBackend

using Dates

include("domain/errors.jl")
include("domain/metrics.jl")
include("domain/prices.jl")
include("infrastructure/csv_prices.jl")

export InsufficientDataError
export simple_returns, log_returns, cumulative_return, mean_return, volatility
export drawdowns, max_drawdown, correlation, correlation_matrix
export PriceBar
export ImportIssue, PriceImportResult, parse_prices_csv, read_prices_csv

end # module MarkovLabBackend

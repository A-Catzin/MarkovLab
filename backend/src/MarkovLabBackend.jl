module MarkovLabBackend

using Dates
import LibPQ
import Random

include("domain/errors.jl")
include("domain/metrics.jl")
include("domain/prices.jl")
include("domain/portfolio.jl")
include("domain/simulation.jl")
include("domain/users.jl")
include("infrastructure/csv_prices.jl")
include("infrastructure/memory_users.jl")
include("infrastructure/postgres_users.jl")
include("services/analysis.jl")
include("services/risk.jl")
include("services/users.jl")
include("api/Api.jl")

export InsufficientDataError
export simple_returns, log_returns, cumulative_return, mean_return, volatility
export drawdowns, max_drawdown, correlation, correlation_matrix
export PriceBar
export Portfolio, PORTFOLIO_WEIGHT_TOLERANCE
export covariance_matrix, portfolio_returns, portfolio_return, portfolio_volatility
export empirical_quantile, value_at_risk, conditional_value_at_risk, summarize_outcomes
export simulate_portfolio_returns
export ImportIssue, PriceImportResult, parse_prices_csv, read_prices_csv
export analyze_prices, run_monte_carlo, MONTE_CARLO_MODEL, MAX_SIMULATIONS, MAX_HORIZON
export GoogleProfile, AppUser, EmailConflictError, UserRepository, save_google_user, sync_google_user
export InMemoryUserRepository, PostgresUserRepository

end # módulo MarkovLabBackend

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
include("domain/assets.jl")
include("infrastructure/csv_prices.jl")
include("infrastructure/memory_users.jl")
include("infrastructure/memory_prices.jl")
include("infrastructure/postgres.jl")
include("infrastructure/postgres_users.jl")
include("infrastructure/postgres_prices.jl")
include("services/analysis.jl")
include("services/risk.jl")
include("services/users.jl")
include("services/prices.jl")
include("services/admin.jl")
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
export AssetDetails, PriceRepository, save_price_import, IMPORT_STATUSES
export PriceImportSummary, import_prices, InMemoryPriceRepository, PostgresPriceRepository
export USER_ROLES, parse_role, ForbiddenError, LastAdminError, find_user, list_users, set_user_role
export list_assets, list_imports, require_admin, change_user_role, admin_summary

end # módulo MarkovLabBackend

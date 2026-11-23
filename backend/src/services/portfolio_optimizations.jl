const OPTIMIZATION_PERIODS_PER_YEAR = 252

function optimization_parameters(positions, bounds)
    ids = Set(x.asset_id for x in positions)
    provided = Dict{Int,Tuple{Float64,Float64}}()
    for row in bounds
        row.asset_id in ids || throw(ArgumentError("asset_id must refer to a portfolio position"))
        haskey(provided, row.asset_id) && throw(ArgumentError("duplicate asset_id in bounds"))
        provided[row.asset_id] = (row.min_weight, row.max_weight)
    end
    limits = [Base.get(provided, x.asset_id, (0.0, 1.0)) for x in positions]
    return first.(limits), last.(limits)
end

function optimization_stats(weights, means, covariance, rate)
    expected = portfolio_return(weights, means)
    vol = portfolio_volatility(weights, covariance)
    return (expected_annual_return=expected, annualized_volatility=vol,
            sharpe_ratio=iszero(vol) ? nothing : (expected - rate) / vol)
end

function optimize_user_portfolio(portfolios::PortfolioRepository, prices::PriceRepository, actor, id;
                                 objective, bounds, lookback_years, risk_free_rate, max_volatility)
    basis = optimization_basis(portfolios, actor, id)
    basis === nothing && return nothing
    objective in ("min_variance", "max_sharpe") || throw(ArgumentError("unknown optimization objective"))
    1 <= lookback_years <= MAX_LOOKBACK_YEARS ||
        throw(ArgumentError("lookback_years must be between 1 and $MAX_LOOKBACK_YEARS"))
    isfinite(risk_free_rate) && -1 <= risk_free_rate <= 1 ||
        throw(ArgumentError("risk_free_rate must be between -1 and 1"))
    portfolio = basis.portfolio
    positions = portfolio.positions
    lower, upper = optimization_parameters(positions, bounds)
    check_optimization_bounds(lower, upper, length(positions))
    series = portfolio_price_series(prices, portfolio)
    common = aligned_prices(series; from=typemin(Date), min_days=MIN_SIMULATION_DAYS)
    window = aligned_prices(series; from=last(common.dates) - Year(lookback_years), min_days=MIN_SIMULATION_DAYS)
    returns = hcat(simple_returns.(window.prices)...)
    periods = OPTIMIZATION_PERIODS_PER_YEAR
    means = [periods * mean_return(view(returns, :, j)) for j in axes(returns, 2)]
    validate_finite(means, "annual expected return")
    covariance = covariance_matrix(returns; periods_per_year=periods)
    minimum = minimum_variance_weights(covariance, lower, upper; max_volatility)
    optimized = objective == "min_variance" ? minimum :
        maximum_sharpe_weights(covariance, means, lower, upper; risk_free_rate, max_volatility)
    manual = [p.weight for p in positions]
    manual_stats = optimization_stats(manual, means, covariance, risk_free_rate)
    optimized_stats = optimization_stats(optimized, means, covariance, risk_free_rate)
    weights = [(
        asset_id=p.asset_id, symbol=p.symbol, name=p.name, market=p.market, asset_currency=p.currency,
        manual_weight=manual[i], optimized_weight=optimized[i], min_weight=lower[i], max_weight=upper[i],
    ) for (i, p) in enumerate(positions)]
    objective_value = objective == "min_variance" ? optimized_stats.annualized_volatility^2 : optimized_stats.sharpe_ratio
    payload = (;
        portfolio_id=portfolio.id, portfolio_version=basis.version, portfolio_name=portfolio.name,
        portfolio.capital, portfolio.currency, portfolio.start_date, objective, objective_value,
        return_model="daily_simple_arithmetic_v1", periods_per_year=periods, risk_free_rate, lookback_years,
        max_volatility, feasible_min_volatility=portfolio_volatility(minimum, covariance),
        window=(from=string(first(window.dates)), to=string(last(window.dates))),
        observations=size(returns, 1), weights, manual_stats, optimized_stats,
        inputs=(annual_mean_returns=means, annual_covariance=[collect(row) for row in eachrow(covariance)]),
        solver=objective == "min_variance" ? "HiGHS" : "SCIP",
        solver_wrapper_version=string(objective == "min_variance" ? Base.pkgversion(HiGHS) : Base.pkgversion(SCIP)),
    )
    return store_optimization(portfolios, actor, portfolio.id, payload)
end

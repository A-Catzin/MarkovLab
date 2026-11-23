const BACKTEST_MODEL = "fixed_target_rebalance_v1"
const BACKTEST_SESSIONS_PER_YEAR = 252
const BACKTEST_MIN_CLOSES = 3
const BACKTEST_REBALANCES = ("none", "monthly", "quarterly", "semiannual")
const BACKTEST_STRATEGIES = ("manual", "min_variance", "max_sharpe")

function backtest_window(series, from, to)
    inside = [[p for p in asset if from <= first(p) <= to] for asset in series]
    return aligned_prices(inside; from, min_days=BACKTEST_MIN_CLOSES)
end

function backtest_bucket(date, rebalance)
    rebalance == "none" && return 0
    width = rebalance == "monthly" ? 1 : rebalance == "quarterly" ? 3 : 6
    return (year(date), div(month(date) - 1, width))
end

function backtest_index(window, target, rebalance, cost_rate)
    dates, prices = window.dates, window.prices
    foreach(validate_prices, prices)
    weights = copy(target)
    index = [100.0 * (1 - cost_rate)]
    for i in 2:length(dates)
        marked = [weights[j] * (prices[j][i] / prices[j][i-1]) for j in eachindex(weights)]
        gross = sum(marked)
        weights = marked ./ gross
        value = last(index) * gross
        # Rebalance at the first shared close of a new bucket, after marking the
        # old holdings to that close. Do not rebalance after the final return.
        if i < length(dates) && backtest_bucket(dates[i], rebalance) != backtest_bucket(dates[i-1], rebalance)
            turnover = sum(abs, target .- weights) / 2
            value *= 1 - cost_rate * turnover
            weights = copy(target)
        end
        push!(index, value)
    end
    validate_prices(index)
    return index
end

function backtest_metrics(index, risk_free_rate)
    # Starting capital was 100 before entry costs. Include those costs in the
    # first measured return without inventing an extra trading session.
    returns = simple_returns([100.0; index[2:end]])
    final = last(index) / 100
    annualized = expm1(log(final) * BACKTEST_SESSIONS_PER_YEAR / length(returns))
    vol = volatility(returns; periods_per_year=BACKTEST_SESSIONS_PER_YEAR)
    sharpe = iszero(vol) ? nothing : (BACKTEST_SESSIONS_PER_YEAR * mean_return(returns) - risk_free_rate) / vol
    validate_finite([annualized, vol, something(sharpe, 0.0)], "backtest metric")
    return (cumulative_return=final - 1, annualized_return=annualized, annualized_volatility=vol,
            max_drawdown=max_drawdown([100.0; index]), sharpe_ratio=sharpe)
end

function calibrate_backtest(config, weights, strategy, risk_free_rate)
    strategy == "manual" && return copy(weights)
    returns = hcat(simple_returns.(config.prices)...)
    cov = covariance_matrix(returns; periods_per_year=BACKTEST_SESSIONS_PER_YEAR)
    lower, upper = zeros(length(weights)), ones(length(weights))
    strategy == "min_variance" && return minimum_variance_weights(cov, lower, upper)
    means = [BACKTEST_SESSIONS_PER_YEAR * mean_return(view(returns, :, i)) for i in axes(returns, 2)]
    return maximum_sharpe_weights(cov, means, lower, upper; risk_free_rate)
end

backtest_coverage(window) = (from=first(window.dates), to=last(window.dates), observations=length(window.dates))

function run_backtest(series, weights; config_from::Date, config_to::Date, eval_from::Date, eval_to::Date,
                      strategy, rebalance="none", transaction_cost_bps=0, risk_free_rate=0.0,
                      benchmark=nothing)
    config_from < config_to < eval_from < eval_to || throw(ArgumentError("backtest windows must be ordered and disjoint"))
    strategy in BACKTEST_STRATEGIES || throw(ArgumentError("unknown backtest strategy"))
    rebalance in BACKTEST_REBALANCES || throw(ArgumentError("unknown backtest rebalance frequency"))
    (isfinite(transaction_cost_bps) && 0 <= transaction_cost_bps <= 1000) ||
        throw(ArgumentError("transaction_cost_bps must be between 0 and 1000"))
    (isfinite(risk_free_rate) && -1 <= risk_free_rate <= 1) ||
        throw(ArgumentError("risk_free_rate must be between -1 and 1"))
    require_matching_assets(weights, length(series))
    all(w -> isfinite(w) && 0 <= w <= 1, weights) &&
        isapprox(sum(weights), 1; rtol=0, atol=PORTFOLIO_WEIGHT_TOLERANCE) ||
        throw(ArgumentError("portfolio weights must be nonnegative and sum to 1"))

    config = backtest_window(series, config_from, config_to)
    target = calibrate_backtest(config, weights ./ sum(weights), strategy, risk_free_rate)
    evaluation_series = benchmark === nothing ? series : [series; [benchmark]]
    evaluation = backtest_window(evaluation_series, eval_from, eval_to)
    assets = (dates=evaluation.dates, prices=evaluation.prices[1:length(series)])
    rate = Float64(transaction_cost_bps) / 10_000
    config_index = backtest_index(config, target, rebalance, rate)
    strategy_index = backtest_index(assets, target, rebalance, rate)
    benchmark_index = if benchmark === nothing
        nothing
    else
        prices = last(evaluation.prices)
        validate_prices(prices)
        100 .* (prices ./ first(prices))
    end
    curve = [(
        date=config.dates[i], phase="config", strategy_index=config_index[i], benchmark_index=nothing,
    ) for i in eachindex(config.dates)]
    actual_curve = [(
        date=evaluation.dates[i], phase="evaluation", strategy_index=strategy_index[i],
        benchmark_index=benchmark_index === nothing ? nothing : benchmark_index[i],
    ) for i in eachindex(evaluation.dates)]
    return (model=BACKTEST_MODEL, target_weights=target, configuration=backtest_coverage(config),
            evaluation=backtest_coverage(evaluation), curve=[curve; actual_curve],
            strategy_metrics=backtest_metrics(strategy_index, risk_free_rate),
            benchmark_metrics=benchmark_index === nothing ? nothing : backtest_metrics(benchmark_index, risk_free_rate))
end

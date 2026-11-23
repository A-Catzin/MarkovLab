struct BacktestBenchmarkNotFound <: Exception end

function backtest_benchmark(prices, benchmark_id, currency)
    benchmark_id === nothing && return (; metadata=nothing, series=nothing)
    benchmark_id > 0 || throw(ArgumentError("benchmark_id must be positive"))
    assets = list_assets(prices)
    found = findfirst(a -> a.id == benchmark_id, assets)
    found === nothing && throw(BacktestBenchmarkNotFound())
    asset = assets[found]
    series = price_history(prices, asset.id)
    if asset.currency != currency
        needed = Set(c for c in (asset.currency, currency) if c != "USD")
        rates = Dict(c => exchange_rates(prices, c) for c in needed)
        series = convert_series(series, asset.currency, currency, rates)
    end
    return (; metadata=(; asset_id=asset.id, asset.symbol, asset.market, asset.currency), series)
end

backtest_dates(window) = (; from=string(window.from), to=string(window.to), window.observations)

function backtest_user_portfolio(portfolios, prices, actor, id; benchmark_id, strategy, rebalance,
                                 transaction_cost_bps, risk_free_rate, config_from, config_to, eval_from, eval_to)
    basis = optimization_basis(portfolios, actor, id)
    basis === nothing && return nothing
    p = basis.portfolio
    data = portfolio_price_series(prices, p)
    benchmark = backtest_benchmark(prices, benchmark_id, p.currency)
    result = run_backtest(data, [x.weight for x in p.positions]; config_from, config_to, eval_from, eval_to,
                          strategy, rebalance, transaction_cost_bps, risk_free_rate, benchmark=benchmark.series)
    payload = (;
        portfolio_id=p.id, portfolio_version=basis.version, portfolio_name=p.name, p.currency,
        result.model, strategy, rebalance, transaction_cost_bps, risk_free_rate,
        config_from=string(config_from), config_to=string(config_to), eval_from=string(eval_from), eval_to=string(eval_to),
        configuration=backtest_dates(result.configuration), evaluation=backtest_dates(result.evaluation),
        weights=[(; asset_id=x.asset_id, x.symbol, x.market, manual_weight=x.weight, target_weight=result.target_weights[i])
                 for (i,x) in enumerate(p.positions)],
        benchmark=benchmark.metadata, result.strategy_metrics, result.benchmark_metrics,
        curve=[(; date=string(x.date), x.phase, x.strategy_index, x.benchmark_index) for x in result.curve],
    )
    return save_backtest(portfolios, actor, p.id, payload)
end

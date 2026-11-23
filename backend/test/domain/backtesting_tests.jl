using Dates
using Test

@testset "Out-of-sample backtesting (B7)" begin
    m = MarkovLabBackend
    config = [Date(2024, 1, d) for d in (1, 2, 3, 4)]
    evaluation = [Date(2024, 1, 31), Date(2024, 2, 1), Date(2024, 2, 2)]
    days = [config; evaluation]
    series(a, b) = [collect(zip(days, a)), collect(zip(days, b))]
    prices = series([100., 105., 103., 106., 100., 200., 200.],
                    [100., 99., 104., 104., 100., 100., 200.])
    windows = (config_from=first(config), config_to=last(config),
               eval_from=first(evaluation), eval_to=last(evaluation))
    weights = [0.5, 0.5]
    passive = m.run_backtest(prices, weights; windows..., strategy="manual", rebalance="none")
    monthly = m.run_backtest(prices, weights; windows..., strategy="manual", rebalance="monthly")
    @test passive.strategy_metrics.cumulative_return ≈ 1.0
    @test monthly.strategy_metrics.cumulative_return ≈ 1.25
    @test monthly.strategy_metrics.max_drawdown == 0
    @test passive.strategy_metrics.annualized_volatility > 0
    @test isfinite(passive.strategy_metrics.sharpe_ratio)
    @test monthly.strategy_metrics.sharpe_ratio === nothing
    @test monthly.benchmark_metrics === nothing
    @test monthly.curve[length(config)+1].phase == "evaluation"
    @test monthly.curve[length(config)+1].strategy_index == 100.0

    priced = m.run_backtest(prices, weights; windows..., strategy="manual", rebalance="monthly", transaction_cost_bps=100)
    @test priced.curve[length(config)+1].strategy_index ≈ 99
    @test priced.curve[end].strategy_index ≈ 100 * .99 * 1.5 * (1 - .01/6) * 1.5
    @test priced.strategy_metrics.max_drawdown ≈ -.01

    benchmark = collect(zip(evaluation, [20., 21., 22.]))
    comparison = m.run_backtest(prices, weights; windows..., strategy="manual", benchmark)
    @test comparison.benchmark_metrics.cumulative_return ≈ .1
    @test comparison.curve[end].benchmark_index ≈ 110
    @test comparison.curve[1].benchmark_index === nothing
    @test_throws m.InsufficientDataError m.run_backtest(prices, weights; windows..., strategy="manual", benchmark=benchmark[1:2])
    @test_throws ArgumentError m.run_backtest(prices, weights; merge(windows, (; eval_from=last(config)))..., strategy="manual")
    @test_throws ArgumentError m.run_backtest(prices, weights; windows..., strategy="manual", transaction_cost_bps=-1)

    optimized = m.run_backtest(prices, weights; windows..., strategy="min_variance")
    changed = series([100., 105., 103., 106., 100., 200., 20.],
                     [100., 99., 104., 104., 100., 100., 10.])
    other = m.run_backtest(changed, weights; windows..., strategy="min_variance")
    @test other.target_weights == optimized.target_weights
    @test other.configuration == optimized.configuration
    @test other.strategy_metrics.cumulative_return != optimized.strategy_metrics.cumulative_return
end

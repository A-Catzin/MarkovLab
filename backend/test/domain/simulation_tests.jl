using Test
using MarkovLabBackend

@testset "Risk measures" begin
    outcomes = [0.1, -0.2, 0.2, 0.0, -0.1]

    @testset "empirical_quantile" begin
        @test empirical_quantile(outcomes, 0.0) == -0.2
        @test empirical_quantile(outcomes, 1.0) == 0.2
        @test empirical_quantile(outcomes, 0.5) == 0.0
        @test empirical_quantile(outcomes, 0.25) ≈ -0.1
        # linear interpolation between neighbours
        @test empirical_quantile(outcomes, 0.125) ≈ -0.15
        @test_throws ArgumentError empirical_quantile(outcomes, 1.5)
        @test_throws InsufficientDataError empirical_quantile(Float64[], 0.5)
    end

    @testset "value_at_risk" begin
        @test value_at_risk(outcomes; confidence=0.75) ≈ 0.1
        @test value_at_risk([0.01, 0.02, 0.03]; confidence=0.95) < 0
        @test value_at_risk(outcomes) ≈ -empirical_quantile(outcomes, 0.05)
        @test_throws ArgumentError value_at_risk(outcomes; confidence=1.0)
        @test_throws ArgumentError value_at_risk(outcomes; confidence=0.0)
        @test_throws ArgumentError value_at_risk([0.1, NaN])
        @test_throws InsufficientDataError value_at_risk(Float64[])
    end

    @testset "conditional_value_at_risk" begin
        @test conditional_value_at_risk(outcomes; confidence=0.75) ≈ 0.15
        @test conditional_value_at_risk(outcomes; confidence=0.99) ≈ 0.2
        values = collect(range(-0.5, 0.5; length=101))
        @test conditional_value_at_risk(values) >= value_at_risk(values)
        @test_throws ArgumentError conditional_value_at_risk(outcomes; confidence=2.0)
    end

    @testset "summarize_outcomes (RF-48)" begin
        summary = summarize_outcomes(outcomes; confidence=0.75)
        @test summary.scenarios == 5
        @test summary.mean ≈ 0.0
        @test summary.worst == -0.2
        @test summary.best == 0.2
        @test summary.percentiles[50] == 0.0
        @test sort(collect(keys(summary.percentiles))) == [1, 5, 25, 50, 75, 95, 99]
        @test summary.confidence == 0.75
        @test summary.value_at_risk ≈ 0.1
        @test summary.conditional_value_at_risk ≈ 0.15
    end
end

@testset "Monte Carlo simulation" begin
    portfolio = Portfolio(["A" => 0.5, "B" => 0.5])
    means = [0.001, 0.002]
    cov = [0.0004 0.0001; 0.0001 0.0009]
    mu_p = portfolio_return(portfolio, means)
    sigma_p = portfolio_volatility(portfolio, cov)

    @testset "reproducible with a seed (RNF-16)" begin
        a = simulate_portfolio_returns(portfolio, means, cov; simulations=100, horizon=5, seed=42)
        b = simulate_portfolio_returns(portfolio, means, cov; simulations=100, horizon=5, seed=42)
        c = simulate_portfolio_returns(portfolio, means, cov; simulations=100, horizon=5, seed=7)
        @test a == b
        @test a != c
        @test length(a) == 100
    end

    @testset "one-period outcomes follow N(μ_p, σ_p)" begin
        n = 50_000
        outcomes = simulate_portfolio_returns(portfolio, means, cov; simulations=n, horizon=1, seed=1)
        @test abs(mean_return(outcomes) - mu_p) < 4 * sigma_p / sqrt(n)
        @test isapprox(volatility(outcomes), sigma_p; rtol=0.02)
    end

    @testset "horizon compounds period returns" begin
        riskless = simulate_portfolio_returns([1.0], [0.01], fill(0.0, 1, 1);
                                              simulations=3, horizon=12, seed=1)
        @test all(r -> r ≈ 1.01^12 - 1, riskless)
    end

    @testset "accepts weight vectors and handles 10,000 scenarios (RNF-03)" begin
        outcomes = simulate_portfolio_returns([0.5, 0.5], means, cov; simulations=10_000, horizon=252, seed=3)
        @test length(outcomes) == 10_000
        @test all(isfinite, outcomes)
    end

    @testset "invalid parameters" begin
        @test_throws ArgumentError simulate_portfolio_returns(portfolio, means, cov; simulations=0)
        @test_throws ArgumentError simulate_portfolio_returns(portfolio, means, cov; horizon=0)
        @test_throws ArgumentError simulate_portfolio_returns(portfolio, [0.001], cov)
        @test_throws ArgumentError simulate_portfolio_returns(portfolio, means, [0.1 0.0; 0.2 0.1])
    end
end

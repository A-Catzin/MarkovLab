using Test
using MarkovLabBackend

@testset "Services" begin
    @testset "analyze_prices" begin
        prices = [100.0, 110.0, 99.0, 108.9]
        result = analyze_prices(prices; periods_per_year=252)
        r = simple_returns(prices)
        @test result.observations == 4
        @test result.cumulative_return ≈ cumulative_return(r)
        @test result.mean_return ≈ mean_return(r)
        @test result.volatility ≈ volatility(r)
        @test result.annualized_volatility ≈ volatility(r; periods_per_year=252)
        @test result.max_drawdown ≈ max_drawdown(prices)
        @test analyze_prices(prices).annualized_volatility === nothing
        err = try
            analyze_prices([100.0, 101.0])
        catch e
            e
        end
        @test err isa InsufficientDataError
        @test (err.required, err.available, err.context) == (3, 2, "analyze_prices")
    end

    @testset "run_monte_carlo" begin
        portfolio = Portfolio(["A" => 0.6, "B" => 0.4])
        prices = [[100.0, 101.0, 99.5, 102.0, 103.0], [50.0, 49.0, 50.5, 51.0, 50.0]]
        result = run_monte_carlo(portfolio, prices; simulations=500, horizon=10, confidence=0.9, seed=7)

        returns = hcat(simple_returns(prices[1]), simple_returns(prices[2]))
        means = [mean_return(returns[:, j]) for j in 1:2]
        cov = covariance_matrix(returns)
        expected = simulate_portfolio_returns(portfolio, means, cov; simulations=500, horizon=10, seed=7)

        @test result.summary == summarize_outcomes(expected; confidence=0.9)
        @test result.expected_period_return ≈ portfolio_return(portfolio, means)
        @test result.expected_period_volatility ≈ portfolio_volatility(portfolio, cov)
        @test result.parameters.symbols == ["A", "B"]
        @test result.parameters.weights == [0.6, 0.4]
        @test result.parameters.simulations == 500
        @test result.parameters.horizon == 10
        @test result.parameters.confidence == 0.9
        @test result.parameters.seed == 7
        @test result.parameters.observations == 5
        @test result.model == MONTE_CARLO_MODEL
    end

    @testset "run_monte_carlo generates and reports a seed when none is given" begin
        portfolio = Portfolio(["A" => 1.0])
        prices = [[100.0, 101.0, 99.5, 102.0]]
        result = run_monte_carlo(portfolio, prices; simulations=50)
        @test result.parameters.seed isa Integer
        again = run_monte_carlo(portfolio, prices; simulations=50, seed=result.parameters.seed)
        @test again.summary == result.summary
    end

    @testset "run_monte_carlo validation (RNF-05)" begin
        portfolio = Portfolio(["A" => 0.5, "B" => 0.5])
        good = [[100.0, 101.0, 102.0], [50.0, 51.0, 49.0]]
        @test_throws ArgumentError run_monte_carlo(portfolio, [good[1]])
        @test_throws ArgumentError run_monte_carlo(portfolio, [good[1], [50.0, 51.0]])
        @test_throws ArgumentError run_monte_carlo(portfolio, good; simulations=MAX_SIMULATIONS + 1)
        @test_throws ArgumentError run_monte_carlo(portfolio, good; horizon=MAX_HORIZON + 1)
        @test_throws ArgumentError run_monte_carlo(portfolio, good; confidence=1.0)
        @test_throws InsufficientDataError run_monte_carlo(portfolio, [[100.0, 101.0], [50.0, 51.0]])
    end
end

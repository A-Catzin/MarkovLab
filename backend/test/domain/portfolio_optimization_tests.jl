@testset "minimum-variance optimization" begin
    engine = MarkovLabBackend
    covariance = [0.04 0.0; 0.0 0.16]
    unconstrained = engine.minimum_variance_weights(covariance, [0.0, 0.0], [1.0, 1.0])
    @test unconstrained ≈ [0.8, 0.2] atol=1e-6
    bounded = engine.minimum_variance_weights(covariance, [0.0, 0.3], [0.7, 1.0])
    @test bounded ≈ [0.7, 0.3] atol=1e-6
    @test engine.minimum_variance_weights(zeros(2, 2), [0.4, 0.6], [0.4, 0.6]) ≈ [0.4, 0.6]

    @test_throws engine.OptimizationInfeasibleError engine.minimum_variance_weights(
        covariance, [0.6, 0.5], [1.0, 1.0])
    @test_throws engine.OptimizationInfeasibleError engine.minimum_variance_weights(
        covariance, [0.0, 0.0], [0.3, 0.6])
    @test_throws ArgumentError engine.minimum_variance_weights(covariance, [0.9, 0.0], [0.8, 1.0])
end

@testset "minimum variance respects an annual volatility cap" begin
    engine = MarkovLabBackend
    covariance = [0.04 0.0; 0.0 0.16]
    lower, upper = zeros(2), ones(2)
    @test engine.minimum_variance_weights(covariance, lower, upper; max_volatility=0.2) ≈ [0.8, 0.2] atol=1e-6
    @test engine.minimum_variance_weights(covariance, lower, upper; max_volatility=sqrt(0.032)) ≈ [0.8, 0.2] atol=1e-6
    @test_throws ArgumentError engine.minimum_variance_weights(covariance, lower, upper; max_volatility=-0.1)
    failure = try
        engine.minimum_variance_weights(covariance, lower, upper; max_volatility=0.17)
        nothing
    catch err
        err
    end
    @test failure isa engine.OptimizationInfeasibleError
    @test failure.reason == :volatility_cap_below_minimum
    @test failure.minimum_volatility ≈ sqrt(0.032) atol=1e-8
end

@testset "maximum Sharpe with constrained weights" begin
    engine = MarkovLabBackend
    covariance = [0.04 0.0; 0.0 0.16]
    lower, upper = zeros(2), ones(2)
    # For positive excess returns and no active cap, weights are proportional
    # to the inverse covariance times the vector of excess returns.
    positive = engine.maximum_sharpe_weights(covariance, [0.10, 0.18], lower, upper; risk_free_rate=0.02)
    @test positive ≈ [2/3, 1/3] atol=1e-5
    bounded = engine.maximum_sharpe_weights(covariance, [0.10, 0.18], lower, [1.0, 0.25]; risk_free_rate=0.02)
    @test bounded ≈ [0.75, 0.25] atol=1e-5

    # Both excess returns are negative; without a cap asset 2 wins despite
    # having a lower return. With the cap, the best point is the high-risk root.
    negative = engine.maximum_sharpe_weights(covariance, [-0.02, -0.03], lower, upper)
    @test negative ≈ [0.0, 1.0] atol=1e-5
    cap = 0.28
    capped = engine.maximum_sharpe_weights(covariance, [-0.02, -0.03], lower, upper; max_volatility=cap)
    @test capped[2] ≈ (0.08 + sqrt(0.08^2 - 4*0.20*(0.04 - cap^2))) / 0.40 atol=1e-5
    @test portfolio_volatility(capped, covariance) ≈ cap atol=1e-6
    @test_throws engine.OptimizationInfeasibleError engine.maximum_sharpe_weights(
        covariance, [0.10, 0.18], lower, upper; max_volatility=0.17)
    @test_throws engine.UndefinedSharpeError engine.maximum_sharpe_weights(
        zeros(2, 2), [0.06, 0.09], lower, upper)
end

@testset "Sharpe does not reject a tight but feasible cap" begin
    covariance = [1e-10 0.0; 0.0 1.0]
    weights = MarkovLabBackend.maximum_sharpe_weights(
        covariance, [0.1, 0.1], zeros(2), ones(2); max_volatility=5e-5)
    @test weights ≈ [1.0, 0.0] atol=1e-7
    @test portfolio_volatility(weights, covariance) ≈ 1e-5 rtol=1e-6
end

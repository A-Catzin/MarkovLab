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

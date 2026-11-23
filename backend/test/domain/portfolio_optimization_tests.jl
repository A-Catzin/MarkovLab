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

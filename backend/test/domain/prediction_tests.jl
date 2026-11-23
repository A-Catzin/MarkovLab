using Dates
using Test

@testset "Empirical prediction baseline (B6)" begin
    M = MarkovLabBackend
    start = Date(2024, 1, 1)
    allprices = [(start + Day(i), 100.0 + i) for i in 0:79]
    cutoff = allprices[60][1]
    training = allprices[1:60]
    settings = (; cutoff, metric="return", horizon_days=21)
    forecast = M.fit_prediction(allprices; settings...)
    @test M.fit_prediction(training; settings...) == forecast
    @test M.fit_prediction([training; [(cutoff + Day(1), 1.0e6)]]; settings...) == forecast
    @test forecast.training_window == (from=start, to=cutoff, observations=59)
    @test forecast.point ≈ M.empirical_quantile(M.simple_returns(last.(training)), 0.5)
    @test forecast.lower_bound < forecast.point < forecast.upper_bound
    @test forecast.horizon_days == 21
    @test_throws M.InsufficientDataError M.fit_prediction(allprices; cutoff=allprices[59][1], metric="return", horizon_days=21)
    @test_throws ArgumentError M.fit_prediction(allprices; cutoff, metric="return", horizon_days=20)
    @test_throws ArgumentError M.fit_prediction(allprices; cutoff, metric="unknown", horizon_days=21)

    @test isempty(M.evaluate_prediction(forecast, training).observations)
    partial = M.evaluate_prediction(forecast, allprices[1:63])
    @test length(partial.observations) == 3
    @test first(partial.observations).session == 1 && first(partial.observations).date == allprices[61][1]
    @test first(partial.observations).value ≈ 1 / 159
    first_errors = [abs(row.value - forecast.point) for row in partial.observations]
    @test partial.summary.mae ≈ sum(first_errors) / 3
    @test partial.summary.rmse ≈ sqrt(sum(abs2, first_errors) / 3)
    @test partial.summary.interval_coverage == 0
    extended = [allprices; [(start + Day(i), 100.0 + i) for i in 80:89]]
    @test length(M.evaluate_prediction(forecast, extended).observations) == 21

    constant = [(date, 100.0) for (date, _) in allprices]
    vol = M.fit_prediction(constant; cutoff, metric="volatility", horizon_days=63)
    @test vol.point == vol.lower_bound == vol.upper_bound == 0
    @test vol.training_window.observations == 39
    @test length(vol.anchor_closes) == 21
    observed = M.evaluate_prediction(vol, [constant[1:60]; [(cutoff + Day(3), 110.0)]])
    @test only(observed.observations).date == cutoff + Day(3)
    @test only(observed.observations).value ≈ M.volatility([zeros(20); 0.1]; periods_per_year=252)
end

using Test
using MarkovLabBackend

@testset "Domain metrics" begin
    prices = [100.0, 110.0, 99.0, 108.9]

    @testset "simple_returns" begin
        @test simple_returns(prices) ≈ [0.10, -0.10, 0.10]
        @test simple_returns([50, 75]) ≈ [0.5]
        @test_throws InsufficientDataError simple_returns([100.0])
        @test_throws ArgumentError simple_returns([100.0, 0.0])
        @test_throws ArgumentError simple_returns([100.0, -5.0])
        @test_throws ArgumentError simple_returns([100.0, NaN])
    end

    @testset "log_returns" begin
        @test log_returns(prices) ≈ log.([1.1, 0.9, 1.1])
        @test sum(log_returns(prices)) ≈ log(108.9 / 100.0)
        @test_throws InsufficientDataError log_returns(Float64[])
        @test_throws ArgumentError log_returns([1.0, Inf])
    end

    @testset "cumulative_return" begin
        @test cumulative_return([0.10, -0.10, 0.10]) ≈ 0.089
        @test cumulative_return(simple_returns(prices)) ≈ 108.9 / 100.0 - 1
        @test_throws InsufficientDataError cumulative_return(Float64[])
    end

    @testset "mean_return" begin
        @test mean_return([0.10, -0.10, 0.10]) ≈ 0.10 / 3
        @test_throws InsufficientDataError mean_return(Float64[])
    end

    @testset "volatility" begin
        returns = [0.01, -0.02, 0.03, 0.00]
        expected = sqrt(sum((returns .- 0.005) .^ 2) / 3)
        @test volatility(returns) ≈ expected
        @test volatility(returns; periods_per_year=252) ≈ expected * sqrt(252)
        @test volatility([0.01, 0.01, 0.01]) == 0.0
        @test_throws InsufficientDataError volatility([0.01])
        @test_throws ArgumentError volatility(returns; periods_per_year=0)
    end

    @testset "drawdowns and max_drawdown" begin
        series = [100.0, 120.0, 90.0, 130.0, 104.0]
        @test drawdowns(series) ≈ [0.0, 0.0, -0.25, 0.0, -0.20]
        @test max_drawdown(series) ≈ -0.25
        @test max_drawdown([1.0, 2.0, 3.0]) == 0.0
        @test_throws InsufficientDataError max_drawdown([100.0])
        @test_throws ArgumentError drawdowns([100.0, 0.0])
    end

    @testset "correlation" begin
        a = [0.01, 0.02, 0.03, 0.04]
        @test correlation(a, 2 .* a) ≈ 1.0
        @test correlation(a, -a) ≈ -1.0
        @test correlation([1.0, 2.0, 3.0], [1.0, 3.0, 2.0]) ≈ 0.5
        @test_throws InsufficientDataError correlation([0.01], [0.02])
        @test_throws ArgumentError correlation([0.01, 0.02], [0.01, 0.02, 0.03])
        @test_throws ArgumentError correlation([0.01, 0.01, 0.01], a[1:3])
    end

    @testset "correlation_matrix" begin
        returns = [1.0 2.0 3.0;
                   2.0 4.0 1.0;
                   3.0 6.0 2.0]
        matrix = correlation_matrix(returns)
        @test size(matrix) == (3, 3)
        @test all(matrix[i, i] == 1.0 for i in 1:3)
        @test matrix ≈ matrix'
        @test matrix[1, 2] ≈ 1.0
        @test matrix[1, 3] ≈ -0.5
        @test_throws ArgumentError correlation_matrix(reshape([1.0, 2.0, 3.0], 3, 1))
        @test_throws InsufficientDataError correlation_matrix([1.0 2.0])
        @test_throws ArgumentError correlation_matrix([1.0 5.0; 1.0 6.0; 1.0 7.0])
    end

    @testset "InsufficientDataError" begin
        err = try
            simple_returns([100.0])
        catch e
            e
        end
        @test err.required == 2
        @test err.available == 1
        @test occursin("2", sprint(showerror, err))
    end
end

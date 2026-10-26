using Test
using MarkovLabBackend

@testset "Portfolio" begin
    @testset "construction and normalization" begin
        p = Portfolio([" aapl " => 0.6, "MSFT" => 0.4])
        @test p.symbols == ["AAPL", "MSFT"]
        @test p.weights == [0.6, 0.4]
        @test Portfolio(["AAPL"], [1.0]).weights == [1.0]
        # se aceptan sumas dentro de la tolerancia documentada
        @test Portfolio(["A", "B", "C"], [1 / 3, 1 / 3, 1 / 3]).weights ≈ fill(1 / 3, 3)
        @test Portfolio(["A", "B"], [0.5, 0.5 + PORTFOLIO_WEIGHT_TOLERANCE / 2]) isa Portfolio
        @test Portfolio(["A", "B"], [1.0, 0.0]).weights == [1.0, 0.0]
    end

    @testset "invalid portfolios (RF-29)" begin
        @test_throws ArgumentError Portfolio(String[], Float64[])
        @test_throws ArgumentError Portfolio(["A", "B"], [1.0])
        @test_throws ArgumentError Portfolio(["A", ""], [0.5, 0.5])
        @test_throws ArgumentError Portfolio(["A", "a"], [0.5, 0.5])
        @test_throws ArgumentError Portfolio(["A", "B"], [1.2, -0.2])
        @test_throws ArgumentError Portfolio(["A", "B"], [0.5, NaN])
        @test_throws ArgumentError Portfolio(["A", "B"], [0.5, 0.4])
        err = try
            Portfolio(["A", "B"], [0.5, 0.4])
        catch e
            e
        end
        @test occursin("0.9", err.msg)
    end
end

@testset "Portfolio metrics" begin
    # filas = fechas, columnas = activos
    returns = [0.01 0.02;
               0.03 -0.01;
               -0.02 0.04]

    @testset "covariance_matrix" begin
        cov = covariance_matrix(returns)
        a, b = returns[:, 1], returns[:, 2]
        sample_cov(x, y) = sum((x .- sum(x) / 3) .* (y .- sum(y) / 3)) / 2
        @test cov ≈ [sample_cov(a, a) sample_cov(a, b); sample_cov(b, a) sample_cov(b, b)]
        @test cov[1, 1] ≈ volatility(a)^2
        @test cov == cov'
        @test covariance_matrix(returns; periods_per_year=252) ≈ cov .* 252
        @test size(covariance_matrix(reshape([0.01, 0.02, 0.03], 3, 1))) == (1, 1)
        @test_throws InsufficientDataError covariance_matrix([0.01 0.02])
        @test_throws ArgumentError covariance_matrix([0.01 NaN; 0.02 0.03])
        @test_throws ArgumentError covariance_matrix(returns; periods_per_year=-1)
    end

    @testset "portfolio_returns" begin
        @test portfolio_returns([0.5, 0.5], returns) ≈ [0.015, 0.01, 0.01]
        @test portfolio_returns(Portfolio(["A", "B"], [1.0, 0.0]), returns) ≈ returns[:, 1]
        @test_throws ArgumentError portfolio_returns([1.0], returns)
        @test_throws InsufficientDataError portfolio_returns([0.5, 0.5], zeros(0, 2))
    end

    @testset "portfolio_return" begin
        means = [0.01, 0.02]
        @test portfolio_return([0.25, 0.75], means) ≈ 0.0175
        @test portfolio_return(Portfolio(["A", "B"], [0.25, 0.75]), means) ≈ 0.0175
        # coincide con la media de la serie histórica de la cartera
        w = [0.4, 0.6]
        asset_means = [mean_return(returns[:, j]) for j in 1:2]
        @test portfolio_return(w, asset_means) ≈ mean_return(portfolio_returns(w, returns))
        @test_throws ArgumentError portfolio_return([1.0], means)
    end

    @testset "portfolio_volatility" begin
        cov = [0.04 0.0; 0.0 0.09]
        @test portfolio_volatility([0.5, 0.5], cov) ≈ sqrt(0.25 * 0.04 + 0.25 * 0.09)
        @test portfolio_volatility([1.0, 0.0], cov) ≈ 0.2
        # coincide con la volatilidad de la serie histórica de la cartera
        w = [0.4, 0.6]
        @test portfolio_volatility(w, covariance_matrix(returns)) ≈ volatility(portfolio_returns(w, returns))
        @test portfolio_volatility(Portfolio(["A", "B"], w), covariance_matrix(returns)) ≈
              volatility(portfolio_returns(w, returns))
        # diversificación: activos con correlación perfectamente negativa se compensan
        @test portfolio_volatility([0.5, 0.5], [0.04 -0.04; -0.04 0.04]) ≈ 0.0 atol = 1e-12
        @test_throws ArgumentError portfolio_volatility([1.0], cov)
        @test_throws ArgumentError portfolio_volatility([0.5, 0.5], [0.04 0.01; 0.02 0.09])
    end
end

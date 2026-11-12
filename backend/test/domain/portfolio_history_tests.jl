using Test
using Dates
using MarkovLabBackend

@testset "Portfolio value history" begin
    d1, d2, d3 = Date(2024, 1, 2), Date(2024, 1, 3), Date(2024, 1, 4)

    @testset "buy and hold anchored at the creation date" begin
        a = [(d1, 10.0), (d2, 11.0), (d3, 12.0)]
        # B no cotizó el día 2 (otro mercado): se usa su último precio.
        b = [(d1, 20.0), (d3, 20.0)]
        history = portfolio_value_history([a, b], [0.5, 0.5], 100.0, d3)
        @test history.dates == [d1, d2, d3]
        @test history.anchor == d3
        # Al anclar en d3 la cartera vale el capital; antes, lo que habría valido.
        @test history.values ≈ [50 * 10 / 12 + 50, 50 * 11 / 12 + 50, 100.0]
    end

    @testset "the window starts when every asset has prices" begin
        a = [(d1, 10.0), (d2, 10.0), (d3, 10.0)]
        b = [(d2, 5.0), (d3, 10.0)]
        history = portfolio_value_history([a, b], [0.5, 0.5], 100.0, d3)
        @test history.dates == [d2, d3]
        @test history.values ≈ [75.0, 100.0]
    end

    @testset "the anchor moves to the closest available day" begin
        a = [(d1, 10.0), (d2, 20.0)]
        # Creada después del último precio: se ancla en el último día con datos.
        later = portfolio_value_history([a], [1.0], 100.0, Date(2024, 2, 1))
        @test later.anchor == d2 && later.values ≈ [50.0, 100.0]
        # Creada antes del primer precio: se ancla en el primero.
        earlier = portfolio_value_history([a], [1.0], 100.0, Date(2023, 1, 1))
        @test earlier.anchor == d1 && earlier.values ≈ [100.0, 200.0]
        # Un día sin precio (fin de semana) toma el anterior.
        between = portfolio_value_history([[(d1, 10.0), (d3, 20.0)]], [1.0], 100.0, d2)
        @test between.anchor == d1
    end

    @testset "not enough prices" begin
        @test_throws InsufficientDataError portfolio_value_history([Tuple{Date,Float64}[]], [1.0], 100.0, d1)
        @test_throws InsufficientDataError portfolio_value_history([[(d1, 10.0)]], [1.0], 100.0, d1)
        # Sin días en común no hay ventana.
        @test_throws InsufficientDataError portfolio_value_history([[(d1, 1.0)], [(d3, 1.0)]], [0.5, 0.5], 1.0, d3)
        @test_throws ArgumentError portfolio_value_history([[(d1, 1.0), (d2, 1.0)]], [0.5, 0.5], 1.0, d2)
    end
end

@testset "Prices aligned for a simulation" begin
    d(i) = Date(2024, 1, 1) + Day(i)
    a = [(d(i), 10.0 + i) for i in 0:9]
    # B no cotizó los días 3 y 4: esos días no entran (no se inventan rendimientos de cero).
    b = [(d(i), 20.0 + i) for i in 0:9 if !(i in (3, 4))]
    aligned = aligned_prices([a, b]; from=d(1), min_days=3)
    @test aligned.dates == [d(i) for i in 1:9 if !(i in (3, 4))]
    @test aligned.prices[1] == [10.0 + i for i in 1:9 if !(i in (3, 4))]
    @test aligned.prices[2] == [20.0 + i for i in 1:9 if !(i in (3, 4))]
    @test_throws InsufficientDataError aligned_prices([a, b]; from=d(8), min_days=3)
    @test_throws InsufficientDataError aligned_prices([a, Tuple{Date,Float64}[]]; from=d(0), min_days=3)
end

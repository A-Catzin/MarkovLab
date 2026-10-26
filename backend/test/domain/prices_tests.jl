using Test
using Dates
using MarkovLabBackend

@testset "PriceBar" begin
    bar = PriceBar(" aapl ", Date(2026, 1, 2), 98.0, 100.5, 97.5, 100.0, 1200)
    @test bar.symbol == "AAPL"
    @test bar.date == Date(2026, 1, 2)
    @test (bar.open, bar.high, bar.low, bar.close, bar.volume) == (98.0, 100.5, 97.5, 100.0, 1200.0)

    @test PriceBar("X", Date(2026, 1, 2), 10, 10, 10, 10, 0).volume == 0.0

    @test_throws ArgumentError PriceBar("", Date(2026, 1, 2), 1, 1, 1, 1, 1)
    @test_throws ArgumentError PriceBar("X", Date(2026, 1, 2), 0, 1, 1, 1, 1)
    @test_throws ArgumentError PriceBar("X", Date(2026, 1, 2), 1, NaN, 1, 1, 1)
    @test_throws ArgumentError PriceBar("X", Date(2026, 1, 2), 1, 1, 1, 1, -1)
    # high menor que open/close, low mayor que open/close
    @test_throws ArgumentError PriceBar("X", Date(2026, 1, 2), 5, 4, 3, 4, 1)
    @test_throws ArgumentError PriceBar("X", Date(2026, 1, 2), 5, 6, 5.5, 5.8, 1)
end

using Test
using Dates
using MarkovLabBackend

@testset "exchange rates" begin
    # Lunes 2026-11-09 a viernes 2026-11-13.
    mon, tue, wed, thu, fri = (Date(2026, 11, 9) + Day(i) for i in 0:4)
    rates = Dict("MXN" => [(mon, 18.0), (tue, 19.0), (thu, 20.0)],
                 "EUR" => [(mon, 0.9), (tue, 0.8), (thu, 0.75)])

    @testset "the same currency leaves the series untouched" begin
        series = [(mon, 10.0), (tue, 11.0)]
        @test convert_series(series, "MXN", "MXN", rates) == series
        # Sin tipos de cambio también: no hace falta ninguno.
        @test convert_series(series, "USD", "USD", Dict{String,Vector{Tuple{Date,Float64}}}()) == series
    end

    @testset "dollars become pesos with the rate of the same day" begin
        @test convert_series([(mon, 10.0), (tue, 11.0)], "USD", "MXN", rates) == [(mon, 180.0), (tue, 209.0)]
    end

    @testset "pesos become dollars" begin
        @test convert_series([(mon, 180.0), (tue, 190.0)], "MXN", "USD", rates) == [(mon, 10.0), (tue, 10.0)]
    end

    @testset "pesos become euros through the dollar" begin
        # 180 MXN = 10 USD = 9 EUR (lunes); 190 MXN = 10 USD = 8 EUR (martes).
        converted = convert_series([(mon, 180.0), (tue, 190.0)], "MXN", "EUR", rates)
        @test first.(converted) == [mon, tue]
        @test last.(converted) ≈ [9.0, 8.0]
    end

    @testset "a day without a rate uses the last known one" begin
        # El miércoles no hay tipo de cambio (feriado del mercado de divisas): usa el del martes.
        @test convert_series([(wed, 10.0), (thu, 10.0)], "USD", "MXN", rates) == [(wed, 190.0), (thu, 200.0)]
    end

    @testset "a rate older than five business days is not used" begin
        stale = Dict("MXN" => [(mon, 18.0)])
        # Del lunes al lunes siguiente hay 5 días hábiles: sirve. Al martes siguiente, 6: no.
        next_mon, next_tue = mon + Day(7), mon + Day(8)
        @test convert_series([(next_mon, 1.0), (next_tue, 1.0)], "USD", "MXN", stale) == [(next_mon, 18.0)]
    end

    @testset "days before the first rate are dropped" begin
        late = Dict("MXN" => [(wed, 20.0)])
        @test convert_series([(mon, 1.0), (tue, 1.0), (wed, 1.0)], "USD", "MXN", late) == [(wed, 20.0)]
    end

    @testset "a missing currency is an error that names the conversion" begin
        err = try
            convert_series([(mon, 1.0)], "USD", "GBP", rates)
            nothing
        catch e
            e
        end
        @test err isa MissingExchangeRateError
        @test (err.from, err.to) == ("USD", "GBP")
        @test occursin("USD to GBP", sprint(showerror, err))
        # También cuando falta la moneda de origen o la serie está vacía.
        @test_throws MissingExchangeRateError convert_series([(mon, 1.0)], "GBP", "MXN", rates)
        @test_throws MissingExchangeRateError convert_series([(mon, 1.0)], "USD", "MXN",
                                                             Dict("MXN" => Tuple{Date,Float64}[]))
    end

    @testset "the in-memory repository stores one rate per currency, date and source" begin
        prices = InMemoryPriceRepository()
        @test exchange_rates(prices, "MXN") == Tuple{Date,Float64}[]
        @test latest_exchange_rate_date(prices, "MXN") === nothing
        @test save_exchange_rates(prices, "MXN", [(tue, 19.0), (mon, 18.0)]) == 2
        # Lo que ya estaba no se duplica ni se reemplaza.
        @test save_exchange_rates(prices, "mxn", [(tue, 99.0), (wed, 19.5)]) == 1
        @test exchange_rates(prices, "MXN") == [(mon, 18.0), (tue, 19.0), (wed, 19.5)]
        @test latest_exchange_rate_date(prices, "MXN") == wed
        @test latest_exchange_rate_date(prices, "MXN"; source=:csv) === nothing
        @test exchange_rates(prices, "EUR") == Tuple{Date,Float64}[]
    end

    @testset "invalid rates are rejected like the table does" begin
        prices = InMemoryPriceRepository()
        @test_throws ArgumentError save_exchange_rates(prices, "USD", [(mon, 1.0)])
        @test_throws ArgumentError save_exchange_rates(prices, "PESOS", [(mon, 1.0)])
        @test_throws ArgumentError save_exchange_rates(prices, "MXN", [(mon, 0.0)])
        @test_throws ArgumentError save_exchange_rates(prices, "MXN", [(mon, NaN)])
        @test_throws ArgumentError save_exchange_rates(prices, "MXN", [(mon, 18.0)]; source=:manual)
        @test exchange_rates(prices, "MXN") == Tuple{Date,Float64}[]
    end
end

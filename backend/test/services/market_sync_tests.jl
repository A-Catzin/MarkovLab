using Test
using Dates
using MarkovLabBackend

# Fuente de mercado falsa: devuelve series fijas y anota cada consulta.
struct FakeMarket <: MarketDataSource
    series::Dict{String,MarketSeries}
    calls::Vector{Tuple{Vector{String},Date,Date}}
end

FakeMarket(series::MarketSeries...) = FakeMarket(Dict(s.symbol => s for s in series), [])

function MarkovLabBackend.fetch_daily_prices(market::FakeMarket, symbols::AbstractVector{<:AbstractString},
                                             from::Date, to::Date)
    push!(market.calls, (collect(String, symbols), from, to))
    return [market.series[s] for s in symbols if haskey(market.series, s)]
end

# Fuente que siempre falla, como una caída de Apify.
struct BrokenMarket <: MarketDataSource end
MarkovLabBackend.fetch_daily_prices(::BrokenMarket, symbols, from, to) =
    throw(MarketDataError("Apify answered HTTP 503 for actor test"))

bar(symbol, date, close=10.0) = PriceBar(symbol, date, close, close + 1, close - 1, close, 1000, close)

function series(symbol, dates; invalid=ImportIssue[], error=nothing)
    details = AssetDetails("Activo $symbol", "NASDAQ", "Acción", "USD")
    return MarketSeries(symbol, error === nothing ? details : nothing,
                        error === nothing ? [bar(symbol, d) for d in dates] : PriceBar[], invalid, error)
end

const DAY1, DAY2, DAY3 = Date(2026, 11, 2), Date(2026, 11, 3), Date(2026, 11, 4)

@testset "Market price sync" begin
    @testset "a full load saves the history with origin api" begin
        prices = InMemoryPriceRepository()
        market = FakeMarket(series("AAPL", [DAY1, DAY2]), series("WALMEX.MX", [DAY1]))
        result = sync_market_prices(prices, market, ["aapl", " WALMEX.MX "]; from=Date(2000, 1, 1), to=DAY3)
        @test only(market.calls) == (["AAPL", "WALMEX.MX"], Date(2000, 1, 1), DAY3)
        @test [s.symbol for s in result.fetched] == ["AAPL", "WALMEX.MX"]
        @test [s.inserted for s in result.fetched] == [2, 1]
        @test all(s.status == :success for s in result.fetched)
        @test isempty(result.up_to_date)
        @test all(key[3] == :api for key in keys(prices.bars))
        @test all(row.source == :api for row in list_imports(prices))
        @test latest_price_date(prices, "AAPL") == DAY2
    end

    @testset "without a start date it continues from the last stored price" begin
        prices = InMemoryPriceRepository()
        sync_market_prices(prices, FakeMarket(series("AAPL", [DAY1]), series("MSFT", [DAY2])), ["AAPL", "MSFT"];
                           from=Date(2000, 1, 1), to=DAY3)
        market = FakeMarket(series("AAPL", [DAY2, DAY3]), series("MSFT", [DAY3]), series("TSLA", [DAY1]))
        result = sync_market_prices(prices, market, ["AAPL", "MSFT", "TSLA"]; to=DAY3)
        # Una sola consulta desde el inicio más antiguo: TSLA, que no tiene precios, pide el historial.
        @test only(market.calls) == (["AAPL", "MSFT", "TSLA"], MARKET_HISTORY_START, DAY3)
        @test [s.inserted for s in result.fetched] == [2, 1, 1]
    end

    @testset "symbols that are already up to date are not requested" begin
        prices = InMemoryPriceRepository()
        sync_market_prices(prices, FakeMarket(series("AAPL", [DAY3])), ["AAPL"]; from=DAY1, to=DAY3)
        market = FakeMarket(series("AAPL", [DAY3]))
        result = sync_market_prices(prices, market, ["AAPL"]; to=DAY3)
        @test isempty(market.calls)
        @test result.up_to_date == ["AAPL"] && isempty(result.fetched)
        # Una respuesta sin precios nuevos tampoco registra una importación vacía.
        before = length(list_imports(prices))
        result = sync_market_prices(prices, FakeMarket(series("AAPL", Date[])), ["AAPL"]; from=DAY1, to=DAY3)
        @test result.up_to_date == ["AAPL"] && length(list_imports(prices)) == before
    end

    @testset "an update does not backfill symbols that already have history" begin
        prices = InMemoryPriceRepository()
        sync_market_prices(prices, FakeMarket(series("AAPL", [DAY2])), ["AAPL"]; from=DAY2, to=DAY2)
        # La consulta empieza en DAY1 por TSLA, pero AAPL solo guarda lo posterior a su último precio.
        market = FakeMarket(series("AAPL", [DAY1, DAY2, DAY3]), series("TSLA", [DAY1]))
        result = sync_market_prices(prices, market, ["AAPL", "TSLA"]; to=DAY3)
        aapl = only(filter(s -> s.symbol == "AAPL", result.fetched))
        @test aapl.inserted == 1 && aapl.valid_rows == 1
        @test sort([key[2] for key in keys(prices.bars) if key[1] == aapl.asset_id]) == [DAY2, DAY3]
    end

    @testset "a new symbol without prices fails instead of looking up to date" begin
        prices = InMemoryPriceRepository()
        result = sync_market_prices(prices, FakeMarket(series("NEW", Date[])), ["NEW"]; to=DAY3)
        @test isempty(result.up_to_date) && only(result.fetched).status == :failed
    end

    @testset "a failed request is recorded for every pending symbol" begin
        prices = InMemoryPriceRepository()
        result = sync_market_prices(prices, BrokenMarket(), ["AAPL", "MSFT"]; from=DAY1, to=DAY3)
        @test all(s.status == :failed for s in result.fetched) && length(result.fetched) == 2
        rows = list_imports(prices)
        @test length(rows) == 2 && all(occursin("HTTP 503", row.message) for row in rows)
    end

    @testset "a symbol the source could not read is recorded as failed" begin
        prices = InMemoryPriceRepository()
        market = FakeMarket(series("AAPL", [DAY1]), series("BAD", Date[]; error="no data for BAD"))
        result = sync_market_prices(prices, market, ["AAPL", "BAD", "GONE"]; from=DAY1, to=DAY3)
        statuses = Dict(s.symbol => s.status for s in result.fetched)
        @test statuses == Dict("AAPL" => :success, "BAD" => :failed, "GONE" => :failed)
        failed = filter(row -> row.status == :failed, list_imports(prices))
        @test length(failed) == 2 && all(row.asset_symbol === nothing && row.source == :api for row in failed)
        @test any(row -> occursin("no data for BAD", something(row.message, "")), failed)
    end

    @testset "corrected rows keep the import successful and are reported" begin
        prices = InMemoryPriceRepository()
        s = series("AAPL", [DAY1, DAY2])
        corrected = MarketSeries(s.symbol, s.details, s.bars, ImportIssue[], nothing,
                                 [ImportIssue(2, "open, high or low were inconsistent")])
        summary = only(sync_market_prices(prices, FakeMarket(corrected), ["AAPL"]; from=DAY1, to=DAY3).fetched)
        result = sync_market_prices(InMemoryPriceRepository(), FakeMarket(corrected), ["AAPL"]; from=DAY1, to=DAY3)
        @test result.corrected == Dict("AAPL" => 1)
        @test summary.status == :success && summary.inserted == 2
        @test occursin("1 rows kept with the close only", only(list_imports(prices)).message)
    end

    @testset "invalid rows make the import partial" begin
        prices = InMemoryPriceRepository()
        market = FakeMarket(series("AAPL", [DAY1, DAY2]; invalid=[ImportIssue(3, "close must be a finite positive number")]))
        summary = only(sync_market_prices(prices, market, ["AAPL"]; from=DAY1, to=DAY3).fetched)
        @test summary.status == :partial && summary.inserted == 2 && length(summary.invalid) == 1
    end

    @testset "api and csv prices of the same day do not collide" begin
        prices = InMemoryPriceRepository()
        csv = "Date,Open,High,Low,Close,Volume,Symbol\n2026-11-02,10,11,9,10,1000,AAPL\n"
        import_prices(prices, IOBuffer(csv), AssetDetails("Activo AAPL", "NASDAQ", "Acción", "USD"))
        summary = only(sync_market_prices(prices, FakeMarket(series("AAPL", [DAY1])), ["AAPL"]; from=DAY1, to=DAY3).fetched)
        @test summary.inserted == 1
        @test latest_price_date(prices, "AAPL"; source=:csv) == DAY1
    end

    @testset "the symbol list is validated" begin
        prices = InMemoryPriceRepository()
        @test_throws ArgumentError sync_market_prices(prices, FakeMarket(), String[]; to=DAY3)
        @test_throws ArgumentError sync_market_prices(prices, FakeMarket(), ["  "]; to=DAY3)
        @test_throws ArgumentError sync_market_prices(prices, FakeMarket(), ["S$i" for i in 1:51]; to=DAY3)
        @test_throws ArgumentError sync_market_prices(prices, FakeMarket(), ["AAPL"]; from=DAY3, to=DAY1)
    end
end

@testset "Exchange rate sync" begin
    fx(symbol, closes) = MarketSeries(symbol, AssetDetails("USD/MXN", "CCY", "Divisa", "MXN"),
                                      [PriceBar(symbol, d, c, c, c, c, 0, c) for (d, c) in closes], ImportIssue[], nothing)

    @testset "a full load saves the close of each day per currency" begin
        prices = InMemoryPriceRepository()
        market = FakeMarket(fx("MXN=X", [(DAY1, 18.5), (DAY2, 18.6)]), fx("EUR=X", [(DAY1, 0.9)]))
        result = sync_exchange_rates(prices, market; from=Date(2000, 1, 1), to=DAY3)
        @test only(market.calls) == (["EUR=X", "MXN=X"], Date(2000, 1, 1), DAY3)
        @test [(r.currency, r.symbol, r.inserted, r.status) for r in result] ==
              [("EUR", "EUR=X", 1, :success), ("MXN", "MXN=X", 2, :success)]
        @test exchange_rates(prices, "MXN") == [(DAY1, 18.5), (DAY2, 18.6)]
        @test exchange_rates(prices, "EUR") == [(DAY1, 0.9)]
        # Las divisas no se guardan como activos ni como importaciones de precios.
        @test isempty(list_assets(prices))
        @test isempty(list_imports(prices))
    end

    @testset "an update continues from the last stored rate and skips currencies up to date" begin
        prices = InMemoryPriceRepository()
        save_exchange_rates(prices, "MXN", [(DAY1, 18.5)])
        save_exchange_rates(prices, "EUR", [(DAY1, 0.9), (DAY2, 0.91)])
        market = FakeMarket(fx("MXN=X", [(DAY1, 99.0), (DAY2, 18.6)]), fx("EUR=X", [(DAY2, 0.91)]))
        result = sync_exchange_rates(prices, market; to=DAY2)
        # Solo se consulta el peso, desde el día después de su último valor.
        @test only(market.calls) == (["MXN=X"], DAY2, DAY2)
        @test [(r.currency, r.inserted, r.status) for r in result] == [("EUR", 0, :up_to_date), ("MXN", 1, :success)]
        @test exchange_rates(prices, "MXN") == [(DAY1, 18.5), (DAY2, 18.6)]
    end

    @testset "a currency the source cannot read is reported as failed" begin
        prices = InMemoryPriceRepository()
        broken = MarketSeries("MXN=X", nothing, PriceBar[], ImportIssue[], "status not_found")
        result = sync_exchange_rates(prices, FakeMarket(broken), ["MXN"]; from=DAY1, to=DAY2)
        @test only(result).status == :failed
        @test only(result).message == "status not_found"
        @test exchange_rates(prices, "MXN") == Tuple{Date,Float64}[]
        # Que no venga en la respuesta también es una falla.
        @test only(sync_exchange_rates(prices, FakeMarket(), ["MXN"]; from=DAY1, to=DAY2)).status == :failed
        # Y si la fuente no responde, todas las pendientes quedan fallidas con el motivo.
        down = sync_exchange_rates(prices, BrokenMarket(); from=DAY1, to=DAY2)
        @test all(r.status == :failed for r in down)
        @test all(occursin("HTTP 503", r.message) for r in down)
    end

    @testset "only supported currencies are accepted" begin
        prices = InMemoryPriceRepository()
        @test_throws ArgumentError sync_exchange_rates(prices, FakeMarket(), ["GBP"])
        @test_throws ArgumentError sync_exchange_rates(prices, FakeMarket(), ["USD"])
        @test_throws ArgumentError sync_exchange_rates(prices, FakeMarket(), String[])
        @test_throws ArgumentError sync_exchange_rates(prices, FakeMarket(); from=DAY3, to=DAY1)
    end
end

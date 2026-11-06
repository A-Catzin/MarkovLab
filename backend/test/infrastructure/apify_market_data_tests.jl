using Test
using Dates
using MarkovLabBackend

# Elemento del dataset del Actor kaix/yahoo-finance-scraper, con la forma observada el
# 2026-11-06: `chart.meta` describe el activo y `chart.series` trae una fila por día.
function actor_item(; symbol="WALMEX.MX", granularity="1d", status="complete", series=nothing)
    # Medianoche de la Ciudad de México (UTC-6) de cada día.
    local_midnight(d) = Int(datetime2unix(DateTime(d)) + 21600)
    rows = something(series, [
        Dict("timestamp" => local_midnight(Date(2026, 11, 3)), "open" => 53.0, "high" => 54.0, "low" => 52.5,
             "close" => 53.5, "adjclose" => 53.4, "volume" => 4_000_000),
        Dict("timestamp" => local_midnight(Date(2026, 11, 4)), "open" => 53.5, "high" => 55.0, "low" => 53.0,
             "close" => 54.0, "adjclose" => 54.0, "volume" => 5_000_000),
        # Día en curso: datos parciales que no se deben guardar.
        Dict("timestamp" => local_midnight(Date(2026, 11, 6)) + 40_000, "open" => 53.3, "high" => 55.0,
             "low" => 52.8, "close" => 54.2, "adjclose" => 54.2, "volume" => 5_035_930),
    ])
    meta = Dict("symbol" => symbol, "currency" => "MXN", "exchangeName" => "MEX", "fullExchangeName" => "Mexico",
                "instrumentType" => "EQUITY", "longName" => "Wal-Mart de México, S.A.B. de C.V.",
                "shortName" => "WAL-MART DE MEXICO", "gmtoffset" => -21600, "dataGranularity" => granularity)
    return Dict("symbol" => symbol, "status" => status, "chart" => Dict("meta" => meta, "series" => rows))
end

# 2026-11-06 a las 17:25 UTC: 11:25 en la Ciudad de México, con el mercado abierto.
const RUN_AT = DateTime(2026, 11, 6, 17, 25)

@testset "Apify market data" begin
    @testset "converts the daily series into price bars" begin
        series = only(MarkovLabBackend.parse_actor_items([actor_item()]; now=RUN_AT))
        @test series.symbol == "WALMEX.MX"
        @test series.error === nothing
        @test series.details == AssetDetails("Wal-Mart de México, S.A.B. de C.V.", "BMV", "Acción", "MXN")
        # Fecha local del mercado; el día en curso queda fuera.
        @test [bar.date for bar in series.bars] == [Date(2026, 11, 3), Date(2026, 11, 4)]
        first_bar = first(series.bars)
        @test (first_bar.open, first_bar.high, first_bar.low, first_bar.close) == (53.0, 54.0, 52.5, 53.5)
        @test first_bar.adj_close == 53.4 && first_bar.volume == 4_000_000
        @test first_bar.symbol == "WALMEX.MX"
        @test isempty(series.invalid)
    end

    @testset "dates survive daylight saving changes" begin
        # El `gmtoffset` es el de hoy (UTC-6), pero en el verano de 2020 México estaba en UTC-5:
        # medianoche local era 05:00 UTC. Una marca a medianoche o a la apertura cae en su día.
        midnight_cdt = Int(datetime2unix(DateTime(2020, 7, 15, 5)))
        open_cdt = Int(datetime2unix(DateTime(2020, 7, 16, 13, 30)))
        rows = [Dict("timestamp" => t, "open" => 1.0, "high" => 2.0, "low" => 0.5, "close" => 1.5,
                     "adjclose" => 1.5, "volume" => 10) for t in (midnight_cdt, open_cdt)]
        series = only(MarkovLabBackend.parse_actor_items([actor_item(series=rows)]; now=RUN_AT))
        @test [bar.date for bar in series.bars] == [Date(2020, 7, 15), Date(2020, 7, 16)]
    end

    @testset "invalid rows are reported and the rest are kept" begin
        midnight = Int(datetime2unix(DateTime(2026, 11, 3)) + 21600)
        rows = [Dict("timestamp" => midnight, "open" => 1.0, "high" => 2.0, "low" => 0.5, "close" => nothing,
                     "adjclose" => nothing, "volume" => nothing),
                Dict("timestamp" => midnight + 86400, "open" => 1.0, "high" => 2.0, "low" => 0.5, "close" => 1.5,
                     "adjclose" => 1.5, "volume" => 10)]
        series = only(MarkovLabBackend.parse_actor_items([actor_item(series=rows)]; now=RUN_AT))
        @test length(series.bars) == 1
        @test only(series.invalid).line == 1
    end

    @testset "markets and categories follow the catalog names" begin
        item = actor_item(symbol="AAPL")
        merge!(item["chart"]["meta"], Dict("exchangeName" => "NMS", "currency" => "USD", "longName" => "Apple Inc.",
                                           "gmtoffset" => -18000))
        @test only(MarkovLabBackend.parse_actor_items([item]; now=RUN_AT)).details ==
              AssetDetails("Apple Inc.", "NASDAQ", "Acción", "USD")
        item["chart"]["meta"]["exchangeName"] = "NYQ"
        item["chart"]["meta"]["instrumentType"] = "ETF"
        details = only(MarkovLabBackend.parse_actor_items([item]; now=RUN_AT)).details
        @test (details.market, details.category) == ("NYSE", "ETF")
        # Un mercado sin traducción conserva el nombre de Yahoo, en mayúsculas.
        item["chart"]["meta"]["exchangeName"] = "LSE"
        item["chart"]["meta"]["fullExchangeName"] = "London"
        @test only(MarkovLabBackend.parse_actor_items([item]; now=RUN_AT)).details.market == "LONDON"
    end

    @testset "unusable items become errors instead of wrong prices" begin
        # Con `range: max` Yahoo resume el historial: nunca se guardan barras mensuales como diarias.
        monthly = only(MarkovLabBackend.parse_actor_items([actor_item(granularity="1mo")]; now=RUN_AT))
        @test isempty(monthly.bars) && occursin("1mo", monthly.error)
        failed = only(MarkovLabBackend.parse_actor_items([actor_item(status="error")]; now=RUN_AT))
        @test isempty(failed.bars) && failed.error !== nothing
        no_chart = only(MarkovLabBackend.parse_actor_items([Dict("symbol" => "ZZZZ", "status" => "complete")]; now=RUN_AT))
        @test no_chart.symbol == "ZZZZ" && no_chart.error !== nothing
    end

    @testset "the actor input asks for daily prices in an explicit range" begin
        input = MarkovLabBackend.actor_input(["AAPL", "WALMEX.MX"], Date(2000, 1, 1), Date(2026, 11, 5))
        @test input["symbols"] == ["AAPL", "WALMEX.MX"]
        @test input["chartInterval"] == "1d"
        @test input["chartStartDate"] == "2000-01-01"
        # El fin se pide un día después: el día final queda incluido.
        @test input["chartEndDate"] == "2026-11-06"
        @test input["includeChart"] == true
        @test !haskey(input, "chartRange")
        @test all(input[key] == false for key in ("includeQuote", "includeProfile", "includeFinancials", "includeNews",
                                                  "includeRecommendations", "includeInsights", "includeAnalyst"))
    end

    @testset "the token is required and never shown" begin
        @test_throws ArgumentError ApifyMarketData("  ")
        source = ApifyMarketData("apify_api_secret-value")
        @test !occursin("secret-value", sprint(show, source))
        @test !occursin("secret-value", sprint(show, MIME"text/plain"(), source))
    end
end

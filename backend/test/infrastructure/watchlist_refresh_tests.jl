using Test
using Dates
using MarkovLabBackend
using MarkovLabBackend: Api

struct RefreshFakeSource <: MarketDataSource
    calls::Vector{String}
end
function MarkovLabBackend.fetch_daily_prices(source::RefreshFakeSource, symbols, from::Date, to::Date)
    append!(source.calls, symbols)
    return [MarketSeries(s, AssetDetails("Refresh test", s == "RFWRONG" ? "OTHER" : "TEST-REFRESH", "ETF", "USD"),
                         [PriceBar(s, to, 15, 15, 15, 15, 10)], ImportIssue[], nothing) for s in symbols]
end

@testset "Market refresh requests (RF-12)" begin
    url = get(ENV, "TEST_DATABASE_URL", "")
    if isempty(url)
        @test_skip false
    else
        users = PostgresUserRepository(url)
        prices = PostgresPriceRepository(url)
        watchlist = MarkovLabBackend.PostgresWatchlist(prices.db)
        key = "r"^40
        root = "/api/internal/watchlist/refresh"
        ana = sync_google_user(users, GoogleProfile("rf12-ana", "rf12-ana@example.test", "Ana"))
        beto = sync_google_user(users, GoogleProfile("rf12-beto", "rf12-beto@example.test", "Beto"))
        details = AssetDetails("Refresh test", "TEST-REFRESH", "ETF", "USD")
        function add_fixture(symbol)
            csv = "Date,Open,High,Low,Close,Volume,Symbol\n2024-06-03,10,10,10,10,10,$symbol\n"
            return import_prices(prices, IOBuffer(csv), details).asset_id
        end
        target, other, wrong = add_fixture("RFTARGET"), add_fixture("RFOTHER"), add_fixture("RFWRONG")
        call(method, path, actor; with_key=true, body=nothing) = api_request(method, path, body;
            headers=with_key ? ["X-Internal-Key" => key, "X-Actor-Id" => actor] : ["X-Actor-Id" => actor])
        try
            Api.configure!(; users, prices, watchlist, internal_key=key)
            @test call("POST", root, ana.id).status == 503
            Api.configure!(; users, prices, watchlist, internal_key=key, refresh_enabled=true)
            @test call("POST", root, ana.id; with_key=false).status == 401
            @test call("POST", root, "").status == 403
            @test call("POST", root, ana.id).status == 422
            @test call("PUT", "/api/internal/watchlist/$target", ana.id).status == 200
            @test call("PUT", "/api/internal/watchlist/$wrong", ana.id).status == 200
            @test call("PUT", "/api/internal/watchlist/$other", beto.id).status == 200
            @test call("PUT", "/api/internal/watchlist/$target", beto.id).status == 200

            # El cuerpo no puede cambiar el actor ni añadir símbolos de otra lista.
            @test call("POST", root, ana.id; body="""{"actor_id":"$(beto.id)","symbols":["RFOTHER"]}""").status == 202
            @test call("POST", root, ana.id).status == 202
            fake = RefreshFakeSource(String[])
            result = MarkovLabBackend.process_market_refresh!(watchlist, prices, fake; to=Date(2024, 6, 4))
            @test result == (; completed=1, failed=1)
            @test sort(fake.calls) == ["RFTARGET", "RFWRONG"]
            @test latest_price_date(prices, "RFTARGET") == Date(2024, 6, 4)
            @test latest_price_date(prices, "RFWRONG") === nothing
            @test latest_price_date(prices, "RFOTHER") === nothing
            @test call("POST", root, beto.id).status == 202
            second_prices = PostgresPriceRepository(url)
            try
                second_queue = MarkovLabBackend.PostgresWatchlist(second_prices.db)
                first = @async MarkovLabBackend.process_market_refresh!(watchlist, prices, fake; to=Date(2024, 6, 4))
                second = @async MarkovLabBackend.process_market_refresh!(second_queue, second_prices, fake; to=Date(2024, 6, 4))
                results = [fetch(first), fetch(second)]
                @test sort([result.completed for result in results]) == [0, 1]
                @test all(result.failed == 0 for result in results)
            finally
                close(second_prices)
            end
            @test count(==("RFTARGET"), fake.calls) == 1
            @test count(==("RFOTHER"), fake.calls) == 1
            @test MarkovLabBackend.process_market_refresh!(watchlist, prices, fake) == (; completed=0, failed=0)
        finally
            Api.configure!(users=nothing, internal_key="")
            conn = MarkovLabBackend.connection!(prices)
            for sql in ("DELETE FROM usuarios WHERE google_sub IN ('rf12-ana', 'rf12-beto')",
                        "DELETE FROM sincronizaciones WHERE activo_id IN (SELECT id FROM activos WHERE mercado = 'TEST-REFRESH') OR mensaje_error = 'the source returned nothing for RFWRONG'",
                        "DELETE FROM activos WHERE mercado = 'TEST-REFRESH'")
                close(MarkovLabBackend.run_query(conn, sql))
            end
            close(users); close(prices)
        end
    end
end

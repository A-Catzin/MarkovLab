using Test
using MarkovLabBackend
using MarkovLabBackend.Api: configure!

@testset "Market watchlist API" begin
    key = "w"^40
    users, prices = InMemoryUserRepository(), InMemoryPriceRepository()
    ana = sync_google_user(users, GoogleProfile("watch-ana", "ana@example.com", "Ana"))
    beto = sync_google_user(users, GoogleProfile("watch-beto", "beto@example.com", "Beto"))
    csv(value, day) = "Date,Open,High,Low,Close,Volume,Symbol\n2024-06-$day,$value,$value,$value,$value,10,AAPL\n"
    details = AssetDetails("Apple", "NASDAQ", "Acción", "USD")
    id = import_prices(prices, IOBuffer(csv(3,10)), details).asset_id
    import_prices(prices, IOBuffer(csv(10,11)), details)
    save_price_import(prices, "AAPL", details, parse_prices_csv(IOBuffer(csv(12,11))).bars, :success, 0, ""; source=:api)
    watchlist = MarkovLabBackend.InMemoryWatchlist(prices)
    configure!(; users, prices, internal_key=key, watchlist)
    root = "/api/internal/watchlist"
    call(method, path=root; actor=ana.id, internal_key=key) =
        api_request(method, path; headers=["X-Internal-Key" => internal_key, "X-Actor-Id" => actor])
    try
        @testset "RF-08: an authenticated user's own persisted list" begin
            @test call("GET").status == 200
            @test call("PUT", "$root/$id").status == 200
            @test call("PUT", "$root/$id").status == 200
            @test call("PUT", "$root/999999").status == 404
            @test call("PUT", "$root/$id"; actor="").status == 403
            @test call("GET"; internal_key="").status == 401
            @test call("DELETE", "$root/$id"; actor=beto.id).status == 404
            @test isempty(response_json(call("GET"; actor=beto.id))["assets"])
            @test call("PUT", "$root/$id"; actor=beto.id).status == 200
            @test call("DELETE", "$root/$id"; actor=beto.id).status == 200
            @test isempty(response_json(call("GET"; actor=beto.id))["assets"])
            @test [a["id"] for a in response_json(call("GET"))["assets"]] == [id]
        end
        @testset "RF-09: newest stored close and date" begin
            asset = only(response_json(call("GET"))["assets"])
            @test asset["currency"] == "USD"
            @test asset["latest_price"] == 12 && asset["latest_date"] == "2024-06-11"
        end
        @testset "RF-11: chronological series, restricted to watched assets" begin
            @test call("GET", "$root/$id/history"; actor=beto.id).status == 404
            history = call("GET", "$root/$id/history")
            @test history.status == 200
            @test response_json(history)["points"] == [["2024-06-10", 3], ["2024-06-11", 12]]
            @test call("DELETE", "$root/$id").status == 200
            @test isempty(response_json(call("GET"))["assets"])
            @test call("GET", "$root/$id/history").status == 404
        end
    finally
        configure!(users=nothing, internal_key="")
    end
end

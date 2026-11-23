using Test
using Dates
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
        @testset "RF-10: close-to-close changes only when a reference exists" begin
            changes = only(response_json(call("GET"))["assets"])["changes"]
            @test changes["daily"] ≈ 3.0
            @test changes["weekly"] === nothing && changes["monthly"] === nothing

            dated_csv = "Date,Open,High,Low,Close,Volume,Symbol\n" *
                        "2024-05-31,100,100,100,100,10,VARIATION\n" *
                        "2024-06-21,110,110,110,110,10,VARIATION\n" *
                        "2024-06-25,111,111,111,111,10,VARIATION\n" *
                        "2024-06-27,120,120,120,120,10,VARIATION\n" *
                        "2024-06-28,132,132,132,132,10,VARIATION\n"
            varied = import_prices(prices, IOBuffer(dated_csv), details).asset_id
            @test call("PUT", "$root/$varied").status == 200
            asset = only(a for a in response_json(call("GET"))["assets"] if a["id"] == varied)
            @test asset["latest_price"] == 132 && asset["latest_date"] == "2024-06-28"
            @test asset["changes"]["daily"] ≈ 0.10
            @test asset["changes"]["weekly"] ≈ 0.20
            @test asset["changes"]["monthly"] === nothing
            june_csv = replace(dated_csv, "2024-05-31" => "2024-05-28")
            import_prices(prices, IOBuffer(june_csv), details)
            updated = only(a for a in response_json(call("GET"))["assets"] if a["id"] == varied)
            @test updated["changes"]["monthly"] ≈ 0.32
            @test call("DELETE", "$root/$varied").status == 200
        end
        @testset "RF-13: provenance and conservative close freshness" begin
            cached = only(response_json(call("GET"))["assets"])
            @test cached["latest_price_source"] == "api"
            @test cached["latest_price_status"] == "cached"
            @test cached["latest_date"] == "2024-06-11"
            reference = Date(now(Dates.UTC)) - Day(1)
            while dayofweek(reference) > 5
                reference -= Day(1)
            end
            function follow_quote(symbol, source, market)
                quote_details = AssetDetails(symbol, market, "Acción", "USD")
                quote_bar = PriceBar(symbol, reference, 10, 10, 10, 10, 10)
                saved = save_price_import(prices, symbol, quote_details, [quote_bar], :success, 0, ""; source)
                @test call("PUT", "$root/$(saved[1])").status == 200
                return saved[1]
            end
            live = follow_quote("RECENTAPI", :api, "NASDAQ")
            file = follow_quote("RECENTCSV", :csv, "NASDAQ")
            unverified = follow_quote("OTHERAPI", :api, "TEST-OTHER")
            listed = Dict(asset["id"] => asset for asset in response_json(call("GET"))["assets"])
            @test listed[live]["latest_price_source"] == "api" && listed[live]["latest_price_status"] == "updated"
            @test listed[file]["latest_price_source"] == "csv" && listed[file]["latest_price_status"] == "local_file"
            @test listed[unverified]["latest_price_source"] == "api" && listed[unverified]["latest_price_status"] == "cached"
            @test isempty(response_json(call("GET"; actor=beto.id))["assets"])
            for quote_id in (live, file, unverified)
                @test call("DELETE", "$root/$quote_id").status == 200
            end
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

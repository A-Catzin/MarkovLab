using Test
using MarkovLabBackend
using MarkovLabBackend.Api: configure!

@testset "Versioned portfolio API (B3)" begin
    users, prices = InMemoryUserRepository(), InMemoryPriceRepository()
    portfolios = InMemoryPortfolioRepository(prices)
    ana = sync_google_user(users, GoogleProfile("b3-ana", "b3-ana@example.test", "Ana"))
    beto = sync_google_user(users, GoogleProfile("b3-beto", "b3-beto@example.test", "Beto"))
    function fixture(symbol)
        data = "Date,Open,High,Low,Close,Volume,Symbol\n2024-06-10,1,2,0.5,1.5,10,$symbol\n"
        import_prices(prices, IOBuffer(data), AssetDetails(symbol, "B3-TEST", "ETF", "USD")).asset_id
    end
    a, b = fixture("B3A"), fixture("B3B")
    key = "v"^40
    path = "/api/internal/portfolios"
    call(method, route=path, body=nothing; actor=ana.id) =
        api_request(method, route, body; headers=["X-Actor-Id" => actor, "X-Internal-Key" => key])
    payload(name, date, u, v, asset_id=b) = """
        {"name":"$name","capital":1000,"currency":"USD","start_date":"$date",
        "positions":[{"asset_id":$a,"weight":$u},{"asset_id":$asset_id,"weight":$v}]}
        """
    configure!(; users, prices, portfolios, internal_key=key)
    try
        result = call("POST", path, payload("Original", "2024-06-01", 0.6, 0.4))
        @test result.status == 201
        created = response_json(result)
        @test created["start_date"] == "2024-06-01"
        @test call("POST", path, payload("Invalid", "2024-02-31", 0.6, 0.4)).status == 400
        route = "$path/$(created["id"])"
        history = "$route/versions"
        @test call("PUT", route, payload("Blocked", "2024-05-01", 0.5, 0.5); actor=beto.id).status == 404
        @test call("GET", history; actor=beto.id).status == 404
        @test call("POST", "$route/duplicate", "{}"; actor=beto.id).status == 404
        @test call("PUT", route, payload("Invalid", "2024-05-01", 0.5, 0.5, 999999)).status == 400
        @test response_json(call("GET", route)) == created
        initial = only(response_json(call("GET", history))["versions"])
        @test initial["version_number"] == 1
        edit = call("PUT", route, payload("Edited", "2024-06-05", 0.2, 0.8))
        @test edit.status == 200
        current = response_json(edit)
        @test current["id"] == created["id"] && current["start_date"] == "2024-06-05"
        @test Dict(p["asset_id"] => p["weight"] for p in current["positions"]) == Dict(a=>0.2,b=>0.8)
        versions = response_json(call("GET", history))["versions"]
        @test [v["version_number"] for v in versions] == [2,1]
        @test [v["is_current"] for v in versions] == [true,false]
        @test versions[2]["id"] == initial["id"]
        @test versions[2]["name"] == "Original" && versions[2]["start_date"] == "2024-06-01"
        @test Dict(p["asset_id"] => p["weight"] for p in versions[2]["positions"]) == Dict(a=>0.6,b=>0.4)
        clone = call("POST", "$route/duplicate", """{"name":"Copy"}""")
        @test clone.status == 201
        copied = response_json(clone)
        @test copied["id"] != current["id"] && copied["derived_from_id"] == current["id"]
        @test copied["start_date"] == current["start_date"] && copied["positions"] == current["positions"]
        @test response_json(call("GET", route)) == current
        default_copy = call("POST", "$route/duplicate", "{}")
        @test default_copy.status == 201
        @test response_json(default_copy)["name"] == "Edited (copia)"
        @test [v["version_number"] for v in response_json(call("GET", "$path/$(copied["id"])/versions"))["versions"]] == [1]
    finally
        configure!(users=nothing, internal_key="")
    end
end

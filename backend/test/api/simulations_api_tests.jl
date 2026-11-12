using Test
using Dates
using MarkovLabBackend
using MarkovLabBackend.Api: configure!

@testset "Internal portfolio simulation API" begin
    key = "k"^40
    users = InMemoryUserRepository()
    prices = InMemoryPriceRepository()
    portfolios = InMemoryPortfolioRepository(prices)
    simulations = InMemorySimulationRepository()
    days = [Date(2024, 1, 1) + Day(i) for i in 0:119]
    ids = map(("AAA", "BBB")) do symbol
        bars = [PriceBar(symbol, d, 100 + i + sin(i), 102 + i + sin(i), 98 + i + sin(i), 100 + i + sin(i), 10)
                for (i, d) in enumerate(days)]
        first(save_price_import(prices, symbol, AssetDetails(symbol, "NASDAQ", "Acción", "USD"), bars, :success, 0,
                                nothing; source=:api))
    end
    ana = sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana"))
    beto = sync_google_user(users, GoogleProfile("sub-2", "beto@example.com", "Beto"))
    saved = create_user_portfolio(users, portfolios, ana.id,
                                  PortfolioDraft("Mixta", 5_000, "USD", [PositionDraft(ids[1], 0.5), PositionDraft(ids[2], 0.5)]))
    configure!(users=users, prices=prices, portfolios=portfolios, simulations=simulations, internal_key=key)
    call(method, path, body=nothing; actor=ana.id, with_key=true) = begin
        headers = Pair{String,String}[]
        with_key && push!(headers, "X-Internal-Key" => key)
        actor === nothing || push!(headers, "X-Actor-Id" => actor)
        api_request(method, path, body; headers)
    end
    path = "/api/internal/portfolios/$(saved.id)/simulations"
    try
        @testset "the owner simulates and lists" begin
            response = call("POST", path, """{"horizon": 21, "simulations": 500, "confidence": 0.99, "seed": 7}""")
            @test response.status == 201
            body = response_json(response)
            @test body["portfolio_id"] == saved.id && body["model"] == MONTE_CARLO_MODEL
            @test (body["horizon"], body["simulations"], body["confidence"], body["seed"]) == (21, 500, 0.99, 7)
            @test body["symbols"] == ["AAA", "BBB"] && body["observations"] == 120
            @test body["window"] == Dict("from" => "2024-01-01", "to" => "2024-04-29")
            @test body["value_at_risk"] <= body["conditional_value_at_risk"]
            @test haskey(body["summary"]["percentiles"], "50")
            @test body["created_at"] isa String
            # Sin campos opcionales: 10 000 escenarios, 95 % y una semilla aleatoria informada.
            defaults = response_json(call("POST", path, """{"horizon": 1}"""))
            @test (defaults["simulations"], defaults["confidence"]) == (10_000, 0.95) && defaults["seed"] isa Integer
            listed = response_json(call("GET", path))["simulations"]
            @test [s["id"] for s in listed] == [defaults["id"], body["id"]]
        end

        @testset "nobody else simulates or sees them" begin
            @test call("POST", path, """{"horizon": 1}"""; actor=beto.id).status == 404
            @test call("GET", path; actor=beto.id).status == 404
            @test call("GET", path; actor=nothing).status == 403
            @test call("POST", path, """{"horizon": 1}"""; with_key=false).status == 401
            @test call("GET", "/api/internal/portfolios/not-a-uuid/simulations").status == 404
        end

        @testset "invalid requests" begin
            for body in ("""{}""", """{"horizon": 0}""", """{"horizon": "uno"}""", """{"horizon": 1, "confidence": 2}""",
                         """{"horizon": 1, "simulations": 100001}""", """{"horizon": 1, "lookback_years": 50}""")
                response = call("POST", path, body)
                @test response.status == 400
                @test response_json(response)["error"] in ("invalid_input", "invalid_json")
            end
        end
    finally
        configure!(users=nothing, internal_key="")
    end
end

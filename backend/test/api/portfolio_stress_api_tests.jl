using Test
using Dates
using MarkovLabBackend
using MarkovLabBackend.Api: configure!

@testset "Portfolio stress API (B4)" begin
    users, prices = InMemoryUserRepository(), InMemoryPriceRepository()
    portfolios = InMemoryPortfolioRepository(prices)
    ana = sync_google_user(users, GoogleProfile("b4-ana", "b4-ana@example.test", "Ana"))
    beto = sync_google_user(users, GoogleProfile("b4-beto", "b4-beto@example.test", "Beto"))
    function asset(symbol, count)
        bars = map(1:count) do i
            price = 100.0 + i + (iseven(i) ? 3.0 : 0.0)
            PriceBar(symbol, Date(2024, 1, 1) + Day(i), price, price, price, price, 1)
        end
        save_price_import(prices, symbol, AssetDetails(symbol, "TEST-STRESS", "ETF", "USD"), bars, :success, 0, "")[1]
    end
    a, b, short = asset("STRESSA", 65), asset("STRESSB", 65), asset("STRESSSHORT", 4)
    draft(id) = PortfolioDraft("Escenario", 1_000, "USD", [PositionDraft(a, 0.5), PositionDraft(id, 0.5)])
    portfolio = create_user_portfolio(users, portfolios, ana.id, draft(b))
    short_portfolio = create_user_portfolio(users, portfolios, ana.id, draft(short))
    key = "s"^40
    configure!(; users, prices, portfolios, internal_key=key)
    call(id, body; actor=ana.id, auth_key=key) = api_request("POST", "/api/internal/portfolios/$id/stress", body;
        headers=["X-Internal-Key" => auth_key, "X-Actor-Id" => actor])
    payload(shift=0, vol=1, corr=0; seed=42) = """
        {"horizon":1,"simulations":2000,"confidence":0.95,"seed":$seed,
         "return_shift":$shift,"volatility_multiplier":$vol,"correlation_shift":$corr}
        """
    try
        @testset "read-only paired Monte Carlo, reproducible and with bounded shocks" begin
            same = call(portfolio.id, payload())
            @test same.status == 200
            zero = response_json(same)
            @test zero["baseline"] == zero["stressed"]
            @test zero["baseline"]["seed"] == 42 && zero["observations"] == 65
            bad_case = call(portfolio.id, payload(-0.3, 2, 0.2))
            @test bad_case.status == 200
            stressed = response_json(bad_case)
            @test stressed == response_json(call(portfolio.id, payload(-0.3, 2, 0.2)))
            @test stressed["stressed"]["expected_final_value"] < stressed["baseline"]["expected_final_value"]
            @test stressed["stressed"]["var_fraction"] > stressed["baseline"]["var_fraction"]
            @test stressed["stressed"]["cvar_fraction"] >= stressed["stressed"]["var_fraction"]
            @test stressed["stressed"]["var_amount"] ≈ 1_000 * stressed["stressed"]["var_fraction"]
            @test stressed["deltas"]["var_fraction"] ≈ stressed["stressed"]["var_fraction"] - stressed["baseline"]["var_fraction"]
            negative = response_json(call(portfolio.id, payload(0, 1, -1)))
            @test negative["stressed"]["var_fraction"] ≈ negative["stressed"]["cvar_fraction"]
            @test get_user_portfolio(users, portfolios, ana.id, portfolio.id) == portfolio
        end
        @testset "invalid parameters, insufficient data and actor isolation" begin
            @test call(portfolio.id, payload(0, 0, 0)).status == 400
            @test call(portfolio.id, payload(0, 1, 1.1)).status == 400
            @test call(portfolio.id, payload(0, 1, 0; seed=-1)).status == 400
            @test call(portfolio.id, payload(); actor=beto.id).status == 404
            @test call(portfolio.id, payload(); auth_key="").status == 401
            @test call(portfolio.id, payload(); actor="").status == 403
            insufficient = call(short_portfolio.id, payload())
            @test insufficient.status == 422
            @test response_json(insufficient)["error"] == "insufficient_data"
        end
    finally
        configure!(users=nothing, internal_key="")
    end
end

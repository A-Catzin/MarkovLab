using Dates
using Test
using MarkovLabBackend
import JSON

function check_backtesting_api(users, prices, portfolios, prefix)
    m = MarkovLabBackend
    user = sync_google_user(users, GoogleProfile("$prefix-1", "$prefix-1@example.test", "Ana"))
    other = sync_google_user(users, GoogleProfile("$prefix-2", "$prefix-2@example.test", "Beto"))
    function asset(suffix, slope)
        name = prefix * suffix
        bars = [PriceBar(name, Date(2024,1,i), fill(100.0+i*slope+(iseven(i) ? 1 : 0),4)...,1) for i in 1:8]
        return first(save_price_import(prices, name, AssetDetails(name, "TEST-B7", "ETF", "USD"), bars, :success, 0, ""))
    end
    a, b, index = asset("A", 1), asset("B", 2), asset("I", 3)
    draft(weight) = PortfolioDraft("Versionada", 1_000, "USD", [PositionDraft(a,weight), PositionDraft(b,1-weight)])
    p = create_user_portfolio(users, portfolios, user.id, draft(0.5))
    key = "7"^40
    m.Api.configure!(; users, prices, portfolios, internal_key=key)
    path = "/api/internal/portfolios/$(p.id)/backtests"
    call(method, body=""; actor=user.id, secret=key) = api_request(method, path, body;
        headers=["X-Internal-Key"=>secret, "X-Actor-Id"=>actor])
    function body(; config_to="2024-01-04", benchmark_id=index)
        JSON.json((strategy="manual", rebalance="quarterly", transaction_cost_bps=10, benchmark_id,
                   config_from="2024-01-01", config_to, eval_from="2024-01-05", eval_to="2024-01-08"))
    end
    try
        @test call("GET"; secret="").status == 401
        @test call("GET"; actor="").status == 403
        @test call("GET"; actor=other.id).status == 404
        @test call("POST", body(); actor=other.id).status == 404
        @test call("POST", body(;config_to="2024-01-05")).status == 400
        @test call("POST", body(;benchmark_id=99999999)).status == 404
        @test response_json(call("GET"))["backtests"] == []
        created = call("POST", body())
        @test created.status == 201
        result = response_json(created)
        @test result["portfolio_version"] == 1 && result["model"] == "fixed_target_rebalance_v1"
        @test result["benchmark"]["asset_id"] == index
        @test length(result["curve"]) == 8
        @test result["curve"][5]["phase"] == "evaluation"
        @test result["curve"][5]["strategy_index"] ≈ 99.9
        @test result["curve"][5]["benchmark_index"] == 100
        @test result["benchmark_metrics"]["cumulative_return"] > 0
        @test get_user_portfolio(users, portfolios, user.id, p.id) == p
        @test m.update_portfolio(portfolios, user.id, p.id, draft(0.3)) !== nothing
        @test response_json(call("GET"))["backtests"] == [result]
        @test delete_user_portfolio(users, portfolios, user.id, p.id)
        @test call("GET").status == 404
    finally
        m.Api.configure!(users=nothing, internal_key="")
    end
end

@testset "Backtesting API (B7)" begin
    prices = InMemoryPriceRepository()
    check_backtesting_api(InMemoryUserRepository(), prices, InMemoryPortfolioRepository(prices), "B7MEM")
    url = get(ENV, "TEST_DATABASE_URL", "")
    if !isempty(url)
        users, prices, portfolios = PostgresUserRepository(url), PostgresPriceRepository(url), PostgresPortfolioRepository(url)
        try
            check_backtesting_api(users, prices, portfolios, "B7SQL")
        finally
            m = MarkovLabBackend
            conn = m.connection!(portfolios)
            for sql in ("DELETE FROM usuarios WHERE google_sub IN ('B7SQL-1', 'B7SQL-2')",
                        "DELETE FROM sincronizaciones WHERE activo_id IN (SELECT id FROM activos WHERE mercado='TEST-B7')",
                        "DELETE FROM activos WHERE mercado='TEST-B7'")
                close(m.run_query(conn, sql))
            end
            foreach(close, (users, prices, portfolios))
        end
    end
end

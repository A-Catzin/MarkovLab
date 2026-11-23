using Dates
using Test
using MarkovLabBackend
import JSON
using MarkovLabBackend.Api: configure!

function check_optimization_api(users, prices, portfolios, prefix)
    m = MarkovLabBackend
    ana = sync_google_user(users, GoogleProfile("$prefix-1", "$prefix-1@example.test", "Ana"))
    beto = sync_google_user(users, GoogleProfile("$prefix-2", "$prefix-2@example.test", "Beto"))
    function asset(symbol, count, amplitude)
        bars = map(1:count) do i
            price = 100.0 + i + amplitude * (iseven(i) ? 1 : 0)
            PriceBar(symbol, Date(2024, 1, 1) + Day(i), price, price, price, price, 1)
        end
        save_price_import(prices, symbol, AssetDetails(symbol, "TEST-B5", "ETF", "USD"), bars, :success, 0, "")[1]
    end
    a, b, short = asset(prefix * "A", 65, 1.0), asset(prefix * "B", 65, 4.0), asset(prefix * "S", 4, 2.0)
    draft(id=b; weight=0.5) = PortfolioDraft("Antes", 1_000, "USD", [PositionDraft(a, weight), PositionDraft(id, 1-weight)])
    portfolio = create_user_portfolio(users, portfolios, ana.id, draft())
    short_portfolio = create_user_portfolio(users, portfolios, ana.id, draft(short))
    key = "z"^40
    configure!(; users, prices, portfolios, internal_key=key)
    call(method, id=portfolio.id, body=""; actor=ana.id, auth=key) = api_request(
        method, "/api/internal/portfolios/$id/optimizations", body; headers=["X-Internal-Key" => auth, "X-Actor-Id" => actor])
    request(objective; kwargs...) = JSON.json(Dict("objective" => objective, (String(k)=>v for (k,v) in kwargs)...))
    try
        @test response_json(call("GET")) == Dict("optimizations"=>[])
        @test call("POST"; auth="").status == 401
        @test call("GET"; actor="").status == 403
        @test call("GET"; actor=beto.id).status == 404
        @test call("POST", portfolio.id, request("min_variance"); actor=beto.id).status == 404
        @test call("POST", portfolio.id, request("unknown")).status == 400
        @test call("POST", portfolio.id, request("min_variance"; bounds=[Dict("asset_id"=>short,"min_weight"=>0,"max_weight"=>1)])).status == 400
        @test call("POST", short_portfolio.id, request("min_variance")).status == 422

        limits = [Dict("asset_id"=>b, "min_weight"=>0.25, "max_weight"=>0.55)]
        infeasible = call("POST", portfolio.id, request("min_variance"; bounds=limits, max_volatility=0))
        @test infeasible.status == 422
        @test response_json(infeasible)["error"] == "optimization_infeasible"
        @test response_json(infeasible)["details"]["minimum_volatility"] > 0
        @test response_json(call("GET")) == Dict("optimizations"=>[])

        response = call("POST", portfolio.id, request("min_variance"; bounds=limits))
        @test response.status == 201
        run = response_json(response)
        @test run["portfolio_version"] == 1 && run["portfolio_name"] == "Antes"
        @test run["objective"] == "min_variance" && run["periods_per_year"] == 252
        @test run["observations"] == 64 && run["window"] == Dict("from"=>"2024-01-02", "to"=>"2024-03-06")
        @test run["objective_value"] ≈ run["optimized_stats"]["annualized_volatility"]^2
        @test run["optimized_stats"]["annualized_volatility"] <= run["manual_stats"]["annualized_volatility"]
        @test sum(row["optimized_weight"] for row in run["weights"]) ≈ 1
        @test 0.25 - 1e-8 <= only(row["optimized_weight"] for row in run["weights"] if row["asset_id"] == b) <= 0.55 + 1e-8
        @test length(run["inputs"]["annual_covariance"]) == 2
        @test length(run["inputs"]["annual_mean_returns"]) == 2
        @test get_user_portfolio(users, portfolios, ana.id, portfolio.id) == portfolio

        edited = m.update_portfolio(portfolios, ana.id, portfolio.id, draft(; weight=0.3))
        @test edited !== nothing
        maximum_sharpe = call("POST", portfolio.id, request("max_sharpe"))
        @test maximum_sharpe.status == 201
        sharpe = response_json(maximum_sharpe)
        @test sharpe["portfolio_version"] == 2
        @test sharpe["objective_value"] ≈ sharpe["optimized_stats"]["sharpe_ratio"]
        @test response_json(call("GET"))["optimizations"] == [sharpe, run]
        @test delete_user_portfolio(users, portfolios, ana.id, portfolio.id)
        @test call("GET").status == 404
    finally
        configure!(users=nothing, internal_key="")
    end
end

@testset "Portfolio optimization API (B5)" begin
    prices = InMemoryPriceRepository()
    check_optimization_api(InMemoryUserRepository(), prices, InMemoryPortfolioRepository(prices), "B5MEM")
    url = Base.get(ENV, "TEST_DATABASE_URL", "")
    if !isempty(url)
        u, p, c = PostgresUserRepository(url), PostgresPriceRepository(url), PostgresPortfolioRepository(url)
        try
            check_optimization_api(u, p, c, "B5SQL")
        finally
            conn = MarkovLabBackend.connection!(c)
            for s in ("DELETE FROM usuarios WHERE google_sub IN ('B5SQL-1', 'B5SQL-2')",
                      "DELETE FROM sincronizaciones WHERE activo_id IN (SELECT id FROM activos WHERE mercado='TEST-B5')",
                      "DELETE FROM activos WHERE mercado='TEST-B5'")
                close(MarkovLabBackend.run_query(conn, s))
            end
            foreach(close, (u, p, c))
        end
    end
end

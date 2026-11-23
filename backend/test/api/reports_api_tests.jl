using Dates
using Test
using MarkovLabBackend
import HTTP
import JSON

@testset "Reports API (B8)" begin
    m = MarkovLabBackend
    key = "8"^40
    path = "/api/internal/reports/summary"
    function call(url; actor="", secret=key, legacy="", canonical=actor)
        api_request("GET", url; headers=["X-Internal-Key"=>secret, "X-Actor-User-Id"=>canonical, "X-Actor-Id"=>legacy])
    end
    @test call(path).status == 503
    url = get(ENV, "TEST_DATABASE_URL", "")
    if !isempty(url)
        users, prices, portfolios = PostgresUserRepository(url), PostgresPriceRepository(url), PostgresPortfolioRepository(url)
        repo = m.PostgresReportsRepository(url)
        alice = sync_google_user(users, GoogleProfile("b8-a", "b8-a@example.test", "Ana"))
        bob = sync_google_user(users, GoogleProfile("b8-b", "b8-b@example.test", "Beto"))
        asset = first(save_price_import(prices, "B8A", AssetDetails("B8", "TEST-B8", "ETF", "USD"),
            [PriceBar("B8A", Date(2024,1,1), 100.,100.,100.,100.,1)], :success, 0, ""))
        own(actor) = create_user_portfolio(users, portfolios, actor, PortfolioDraft("Live name", 100, "USD", [PositionDraft(asset,1)]))
        a, b = own(alice.id), own(bob.id)
        conn = m.connection!(repo.db)
        execute(sql, params=String[]) = close(m.run_query(conn, sql, params))
        function store(table, id, owner, timestamp, payload)
            sql = "INSERT INTO $table (id,cartera_id,creado_en,resultado) VALUES (\$1::uuid,\$2::uuid,\$3::timestamptz,\$4::jsonb)"
            execute(sql, [id, owner, timestamp, JSON.json(payload)])
        end
        ids = ["00000000-0000-4000-8000-00000000000$i" for i in 1:5]
        window = (; from="2024-01-01", to="2024-01-04")
        subject = "\t=1+1, \"Lab\"\nRow"
        opt = (portfolio_name=subject, currency="USD", objective="min_variance", window,
               optimized_stats=(expected_annual_return=-0.125, annualized_volatility=0.2, sharpe_ratio=-0.625))
        m.Api.configure!(; users, reports=repo, internal_key=key)
        try
            @test response_json(call(path; actor=bob.id))["reports"] == []
            store("optimizaciones_cartera", ids[1], a.id, "2024-01-04T10:00:00Z", opt)
            store("optimizaciones_cartera", ids[2], b.id, "2024-01-05T10:00:00Z", merge(opt, (; portfolio_name="Private B8")))
            store("backtests_cartera", ids[3], a.id, "2024-01-06T10:00:00Z",
                  (portfolio_name="Backtest", currency="USD", evaluation=window,
                   strategy="manual", strategy_metrics=(cumulative_return=0.1,)))
            execute("""
                INSERT INTO predicciones_activos (id,usuario_id,activo_id,creado_en,datos)
                VALUES (\$1::uuid,\$2::uuid,\$3::bigint,'2024-01-07T10:00:00Z',\$4::jsonb)
                """, [ids[4], alice.id, string(asset), JSON.json((symbol="B8A", metric="return", horizon_days=21,
                                                                     point=0.01, training_window=window))])
            execute("""
                INSERT INTO simulaciones (id,usuario_id,cartera_id,modelo,num_simulaciones,horizonte,confianza,
                    semilla,observaciones,activos,retorno_esperado_periodo,volatilidad_esperada_periodo,
                    valor_en_riesgo,valor_en_riesgo_condicional,resumen,creado_en)
                VALUES (\$1::uuid,\$2::uuid,\$3::uuid,'mc',100,21,0.95,23,10,
                    '{"symbols":["B8A"],"weights":[1]}'::jsonb,0.05,0.25,0.15,0.2,\$4::jsonb,'2024-01-05T11:00:00Z')
                """, [ids[5], alice.id, a.id, JSON.json((estimation_window=window,))])
            @test call(path; actor=alice.id, secret="").status == 401
            @test call(path).status == 403
            @test call(path; actor=alice.id, legacy=bob.id).status == 400
            @test call(path*"?limit=51"; actor=alice.id).status == 400
            report = call(path; legacy=alice.id)
            @test HTTP.header(report, "Cache-Control") == "private, no-store"
            data = response_json(report)
            @test [x["kind"] for x in data["reports"]] == ["prediction", "backtest", "simulation", "optimization"]
            @test length(response_json(call(path*"?limit=1"; actor=alice.id))["reports"]) == 1
            @test all(x["id"] != "optimization:"*ids[2] for x in data["reports"])
            @test first(data["reports"])["currency"] === nothing
            @test data["reports"][3]["parameters"]["seed"] == 23
            @test !isempty(data["formulas"])
            visible = last(data["reports"])
            @test visible["subject"] == subject
            @test visible["source"]["ingestion"] === nothing
            @test visible["period_from"] == "2024-01-01"
            export_path = "/api/internal/reports/$(visible["id"])/export"
            @test call(export_path*"?format=json"; actor=alice.id).status == 400
            @test call(export_path; actor=bob.id).status == 404
            @test call("/api/internal/reports/unknown:"*ids[1]*"/export"; actor=alice.id).status == 404
            response = call(export_path*"?format=csv"; actor=alice.id)
            @test response.status == 200
            @test startswith(HTTP.header(response, "Content-Type"), "text/csv")
            @test HTTP.header(response, "Cache-Control") == "private, no-store"
            csv = String(response.body)
            @test occursin(visible["id"], csv) && occursin("-0.125", csv)
            @test occursin("text: =1+1, \"\"Lab\"\"\nRow", csv)
            @test !occursin("Private B8", csv) && !occursin(ids[2], csv)
        finally
            m.Api.configure!(users=nothing, internal_key="")
            for sql in ("DELETE FROM usuarios WHERE google_sub IN ('b8-a','b8-b')",
                        "DELETE FROM sincronizaciones WHERE activo_id IN (SELECT id FROM activos WHERE mercado='TEST-B8')",
                        "DELETE FROM activos WHERE mercado='TEST-B8'")
                execute(sql)
            end
            foreach(close, (users, prices, portfolios, repo.db))
        end
    end
end

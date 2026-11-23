using Test
using Dates
using MarkovLabBackend
using MarkovLabBackend.Api: configure!

@testset "Historical asset analysis (B2)" begin
    users, prices = InMemoryUserRepository(), InMemoryPriceRepository()
    actor = sync_google_user(users, GoogleProfile("analysis-actor", "analysis@example.test", "Ana"))
    key = "b"^40
    headers = ["X-Internal-Key" => key, "X-Actor-Id" => actor.id]
    function store_series(symbol, rows)
        bars = [PriceBar(symbol, Date(date), value, value, value, value, 1) for (date, value) in rows]
        save_price_import(prices, symbol, AssetDetails(symbol, "NASDAQ", "ETF", "USD"), bars, :success, 0, "")
    end
    store_series("TESTA", [("2024-06-03", 100), ("2024-06-04", 450), ("2024-06-05", 110), ("2024-06-07", 99)])
    store_series("TESTB", [("2024-06-03", 100), ("2024-06-05", 90), ("2024-06-06", 300), ("2024-06-07", 99)])
    store_series("TESTC", [("2024-06-03", 20), ("2024-06-05", 20), ("2024-06-07", 20)])
    root = "/api/internal/analysis/assets"
    payload = """{"symbols":["testa","TESTB","TESTC"],"period":"custom","from":"2024-06-03","to":"2024-06-07","return_kind":"simple"}"""
    configure!(; users, prices, internal_key=key)
    call(body=payload; auth=headers) = api_request("POST", root, body; headers=auth)
    try
        @testset "uses only shared sessions, correct metrics and Pearson correlation" begin
            response = call()
            @test response.status == 200
            data = response_json(response)
            @test data["aligned_observations"] == 3
            @test data["effective_from"] == "2024-06-03" && data["effective_to"] == "2024-06-07"
            @test data["correlation_symbols"] == ["TESTA", "TESTB", "TESTC"]
            @test data["correlation_matrix"][1][2] ≈ -1
            @test data["correlation_matrix"][1][3] === nothing
            points = data["series_aligned"][1]["points"]
            @test first.(points) == ["2024-06-03", "2024-06-05", "2024-06-07"]
            @test last.(points) ≈ [100, 110, 99]
            row = data["per_asset_metrics"][1]
            @test row["simple_return"] ≈ -0.01
            @test row["log_return"] ≈ log(0.99)
            @test row["cumulative_return"] ≈ -0.01
            @test row["mean_return_daily"] ≈ 0.0 atol=1e-12
            @test row["volatility_daily"] ≈ sqrt(0.02)
            @test row["volatility_annualized"] ≈ sqrt(0.02*252)
            @test row["max_drawdown"] ≈ -0.10
            @test row["peak_date"] == "2024-06-05" && row["trough_date"] == "2024-06-07"
            log_result = response_json(call(replace(payload, "\"simple\"" => "\"log\"")))
            @test log_result["return_kind"] == "log"
            @test log_result["per_asset_metrics"][1]["mean_return_daily"] ≈ log(0.99)/2
        end
        @testset "insufficient, two-close and invalid windows are distinguished" begin
            short = call(replace(payload, "\"2024-06-07\"" => "\"2024-06-04\""))
            @test short.status == 422
            err = response_json(short)
            @test err["error"] == "insufficient_data"
            @test err["required_sessions"] == 2 && err["observed_sessions"] == 1
            two = call(replace(payload, "\"2024-06-07\"" => "\"2024-06-05\""))
            @test two.status == 200
            data = response_json(two)
            @test data["aligned_observations"] == 2
            @test data["per_asset_metrics"][1]["volatility_daily"] === nothing
            @test all(all(isnothing, row) for row in data["correlation_matrix"])
            @test call(replace(payload, "2024-06-03" => "2024-02-31")).status == 400
            @test call(replace(payload, "TESTB" => "testa")).status == 400
            @test call(replace(payload, "TESTB" => "UNKNOWN")).status == 400
            @test call(; auth=["X-Actor-Id" => actor.id]).status == 401
            @test call(; auth=["X-Internal-Key" => key]).status == 403
        end
    finally
        configure!(users=nothing, internal_key="")
    end
end

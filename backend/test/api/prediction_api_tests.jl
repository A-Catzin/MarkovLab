using Dates
using Test
using MarkovLabBackend
import JSON

function check_prediction_api(users, prices, predictions, prefix)
    m = MarkovLabBackend
    ana = sync_google_user(users, GoogleProfile("$prefix-1", "$prefix-1@example.test", "Ana"))
    beto = sync_google_user(users, GoogleProfile("$prefix-2", "$prefix-2@example.test", "Beto"))
    name = prefix * "A"
    day = Date(2024, 1, 1)
    bars(from, to) = [PriceBar(name, day+Day(i), map(_ -> 100.0+i, 1:4)..., 1) for i in from:to]
    details = AssetDetails(name, "TEST-B6", "ETF", "USD")
    asset = first(save_price_import(prices, name, details, bars(0, 59), :success, 0, ""))
    key = "b"^40
    m.Api.configure!(; users, prices, predictions, internal_key=key)
    call(method, path, body=""; actor=ana.id, auth=key) =
        api_request(method, path, body; headers=["X-Internal-Key"=>auth, "X-Actor-Id"=>actor])
    path = "/api/internal/assets/$asset/predictions"
    request = """{"metric":"return","horizon_days":21,"as_of":"2024-02-29"}"""
    try
        @test call("POST", path, request; auth="").status == 401
        @test call("POST", path, request; actor="").status == 403
        @test call("POST", "/api/internal/assets/99999999/predictions", request).status == 404
        @test call("POST", path, """{"metric":"return","horizon_days":15}""").status == 400
        @test call("POST", path, """{"metric":"return","horizon_days":21,"as_of":"2024-01-05"}""").status == 422
        response = call("POST", path, request)
        @test response.status == 201
        run = response_json(response)
        @test run["asset_id"] == asset && run["symbol"] == name
        @test run["training_window"]["to"] == run["as_of"] == "2024-02-29"
        @test run["evaluation"] === nothing
        @test run["series"][end]["date_estimated"]
        @test all(s["phase"] == "forecast" && s["observed_after_value"] === nothing for s in run["series"][end-20:end])
        run_path = "/api/internal/predictions/$(run["id"])"
        @test call("GET", run_path; actor=beto.id).status == 404
        @test response_json(call("GET", run_path)) == run

        save_price_import(prices, name, details, bars(60, 62), :success, 0, "")
        checked = response_json(call("GET", run_path))
        @test checked["training_window"] == run["training_window"]
        @test checked["calculated_at"] == run["calculated_at"]
        @test checked["evaluation"]["observed_points"] == 3
        @test checked["series"][end-20]["date"] == "2024-03-01"
        @test !checked["series"][end-20]["date_estimated"]
        @test checked["series"][end-20]["observed_after_value"] ≈ 1 / 159
        @test checked["series"][end-20]["forecast_point"] == run["series"][end-20]["forecast_point"]
    finally
        m.Api.configure!(users=nothing, internal_key="")
    end
end

@testset "Prediction API (B6)" begin
    check_prediction_api(InMemoryUserRepository(), InMemoryPriceRepository(), MarkovLabBackend.InMemoryPredictionRepository(), "B6MEM")
    url = get(ENV, "TEST_DATABASE_URL", "")
    if !isempty(url)
        m = MarkovLabBackend
        users, prices, predictions = PostgresUserRepository(url), PostgresPriceRepository(url), m.PostgresPredictionRepository(url)
        try
            check_prediction_api(users, prices, predictions, "B6SQL")
        finally
            conn = m.connection!(predictions.db)
            for sql in ("DELETE FROM usuarios WHERE google_sub IN ('B6SQL-1', 'B6SQL-2')",
                        "DELETE FROM sincronizaciones WHERE activo_id IN (SELECT id FROM activos WHERE mercado='TEST-B6')",
                        "DELETE FROM activos WHERE mercado='TEST-B6'")
                close(m.run_query(conn, sql))
            end
            foreach(close, (users, prices, predictions.db))
        end
    end
end

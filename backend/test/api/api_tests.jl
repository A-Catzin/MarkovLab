using Test
using HTTP
using MarkovLabBackend
using MarkovLabBackend.Api: parse_allowed_origins, cors_middleware

function api_request(method, path, body=nothing; headers=Pair{String,String}[], middleware=[])
    request = body === nothing ? HTTP.Request(method, path, headers) :
              HTTP.Request(method, path, ["Content-Type" => "application/json"; headers], body)
    return MarkovLabBackend.Api.internalrequest(request; middleware)
end

response_json(response) = MarkovLabBackend.Api.json(response)

@testset "HTTP API" begin
    @testset "GET /health" begin
        response = api_request("GET", "/health")
        @test response.status == 200
        body = response_json(response)
        @test body["status"] == "ok"
        @test body["service"] == "markovlab-backend"
    end

    @testset "POST /api/analysis/metrics" begin
        response = api_request("POST", "/api/analysis/metrics",
                               """{"prices": [100, 110, 99, 108.9], "periods_per_year": 252}""")
        @test response.status == 200
        body = response_json(response)
        expected = analyze_prices([100, 110, 99, 108.9]; periods_per_year=252)
        @test body["observations"] == 4
        @test body["cumulative_return"] ≈ expected.cumulative_return
        @test body["volatility"] ≈ expected.volatility
        @test body["annualized_volatility"] ≈ expected.annualized_volatility
        @test body["max_drawdown"] ≈ expected.max_drawdown

        without_period = response_json(api_request("POST", "/api/analysis/metrics", """{"prices": [100, 110, 99]}"""))
        @test without_period["annualized_volatility"] === nothing
    end

    @testset "POST /api/risk/monte-carlo" begin
        payload = """
        {"assets": [{"symbol": "aapl", "weight": 0.6, "prices": [100, 101, 99.5, 102, 103]},
                    {"symbol": "MSFT", "weight": 0.4, "prices": [50, 49, 50.5, 51, 50]}],
         "simulations": 500, "horizon": 10, "confidence": 0.9, "seed": 7}
        """
        response = api_request("POST", "/api/risk/monte-carlo", payload)
        @test response.status == 200
        body = response_json(response)
        expected = run_monte_carlo(Portfolio(["AAPL" => 0.6, "MSFT" => 0.4]),
                                   [[100, 101, 99.5, 102, 103], [50, 49, 50.5, 51, 50]];
                                   simulations=500, horizon=10, confidence=0.9, seed=7)
        @test body["parameters"]["symbols"] == ["AAPL", "MSFT"]
        @test body["parameters"]["seed"] == 7
        @test body["model"] == MONTE_CARLO_MODEL
        @test body["summary"]["value_at_risk"] ≈ expected.summary.value_at_risk
        @test body["summary"]["conditional_value_at_risk"] ≈ expected.summary.conditional_value_at_risk
        @test body["summary"]["percentiles"]["50"] ≈ expected.summary.percentiles[50]
        @test body["summary"]["scenarios"] == 500
    end

    @testset "errors are JSON with a code" begin
        cases = [
            ("POST", "/api/analysis/metrics", "{bad json", 400, "invalid_json"),
            ("POST", "/api/analysis/metrics", """{"values": [1, 2, 3]}""", 400, "invalid_input"),
            ("POST", "/api/analysis/metrics", """{"prices": [100, "x", 3]}""", 400, "invalid_input"),
            ("POST", "/api/analysis/metrics", """{"prices": [100, -1, 3]}""", 400, "invalid_input"),
            ("POST", "/api/analysis/metrics", """{"prices": [100, 101]}""", 422, "insufficient_data"),
            ("POST", "/api/risk/monte-carlo",
             """{"assets": [{"symbol": "A", "weight": 0.5, "prices": [1, 2, 3]}]}""", 400, "invalid_input"),
            ("POST", "/api/risk/monte-carlo",
             """{"assets": [{"symbol": "A", "weight": 1, "prices": [1, 2, 3]}], "simulations": 1000000000}""",
             400, "invalid_input"),
            ("POST", "/api/risk/monte-carlo", """{"assets": "nope"}""", 400, "invalid_input"),
        ]
        for (method, path, body, status, code) in cases
            response = api_request(method, path, body)
            @test response.status == status
            payload = response_json(response)
            @test payload["error"] == code
            @test payload["message"] isa String && !isempty(payload["message"])
        end
    end

    @testset "CORS" begin
        @test parse_allowed_origins("http://localhost:3000, https://markovlab.vercel.app ,") ==
              ["http://localhost:3000", "https://markovlab.vercel.app"]
        @test parse_allowed_origins("") == String[]

        cors = [cors_middleware(["http://localhost:3000"])]
        allowed = api_request("GET", "/health"; headers=["Origin" => "http://localhost:3000"], middleware=cors)
        @test HTTP.header(allowed, "Access-Control-Allow-Origin") == "http://localhost:3000"
        @test HTTP.header(allowed, "Vary") == "Origin"

        other = api_request("GET", "/health"; headers=["Origin" => "https://evil.example"], middleware=cors)
        @test other.status == 200
        @test HTTP.header(other, "Access-Control-Allow-Origin") == ""

        preflight = api_request("OPTIONS", "/api/analysis/metrics";
                                headers=["Origin" => "http://localhost:3000"], middleware=cors)
        @test preflight.status == 204
        @test occursin("POST", HTTP.header(preflight, "Access-Control-Allow-Methods"))
        @test HTTP.header(preflight, "Access-Control-Allow-Origin") == "http://localhost:3000"

        rejected = api_request("OPTIONS", "/api/analysis/metrics";
                               headers=["Origin" => "https://evil.example"], middleware=cors)
        @test rejected.status == 403

        any_origin = api_request("GET", "/health"; headers=["Origin" => "https://any.example"],
                                 middleware=[cors_middleware(["*"])])
        @test HTTP.header(any_origin, "Access-Control-Allow-Origin") == "https://any.example"
    end
end

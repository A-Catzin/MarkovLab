using Test
using HTTP
using MarkovLabBackend
using MarkovLabBackend.Api: configure!

@testset "Internal portfolio and CSV upload API" begin
    key = "k"^40
    users = InMemoryUserRepository()
    prices = InMemoryPriceRepository()
    portfolios = InMemoryPortfolioRepository(prices)
    csv(symbol) = "Date,Open,High,Low,Close,Volume,Symbol\n2024-06-10,1,2,0.5,1.5,10,$symbol\n"
    aapl = import_prices(prices, IOBuffer(csv("AAPL")), AssetDetails("Apple", "NASDAQ", "Acción", "USD")).asset_id
    msft = import_prices(prices, IOBuffer(csv("MSFT")), AssetDetails("Microsoft", "NASDAQ", "Acción", "USD")).asset_id
    admin = sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana"))
    set_user_role(users, admin.id, :admin)
    beto = sync_google_user(users, GoogleProfile("sub-2", "beto@example.com", "Beto"))

    configure!(users=users, prices=prices, portfolios=portfolios, internal_key=key)
    call(method, path, body=nothing; actor=beto.id, with_key=true) = begin
        headers = Pair{String,String}[]
        with_key && push!(headers, "X-Internal-Key" => key)
        actor === nothing || push!(headers, "X-Actor-Id" => actor)
        api_request(method, path, body; headers)
    end
    try
        @testset "any signed-in user can list assets for the form" begin
            body = response_json(call("GET", "/api/internal/assets"))
            @test sort([a["symbol"] for a in body["assets"]]) == ["AAPL", "MSFT"]
            @test call("GET", "/api/internal/assets"; actor=nothing).status == 403
            @test call("GET", "/api/internal/assets"; with_key=false).status == 401
        end

        payload = """{"name": "Tecnología", "capital": 10000, "currency": "usd",
                      "positions": [{"asset_id": $aapl, "weight": 0.6}, {"asset_id": $msft, "weight": 0.4}]}"""
        created_id = ""

        @testset "create, list and read a portfolio" begin
            response = call("POST", "/api/internal/portfolios", payload)
            @test response.status == 201
            body = response_json(response)
            created_id = body["id"]
            @test body["name"] == "Tecnología" && body["currency"] == "USD" && body["status"] == "draft"
            @test [p["symbol"] for p in body["positions"]] == ["AAPL", "MSFT"]
            @test body["positions"][1]["weight"] ≈ 0.6

            listed = response_json(call("GET", "/api/internal/portfolios"))["portfolios"]
            @test [p["id"] for p in listed] == [created_id]
            @test response_json(call("GET", "/api/internal/portfolios/$created_id"))["capital"] == 10000
        end

        @testset "nobody else sees or deletes it" begin
            @test isempty(response_json(call("GET", "/api/internal/portfolios"; actor=admin.id))["portfolios"])
            @test call("GET", "/api/internal/portfolios/$created_id"; actor=admin.id).status == 404
            @test call("DELETE", "/api/internal/portfolios/$created_id"; actor=admin.id).status == 404
            @test call("GET", "/api/internal/portfolios"; actor=nothing).status == 403
            @test call("GET", "/api/internal/portfolios"; actor="00000000-0000-4000-8000-000000000000").status == 403
        end

        @testset "history of a portfolio" begin
            # Con un solo día de precios no hay historia que dibujar.
            short = call("GET", "/api/internal/portfolios/$created_id/history")
            @test short.status == 422 && response_json(short)["error"] == "insufficient_data"
            more(symbol) = "Date,Open,High,Low,Close,Volume,Symbol\n2024-06-11,1,4,0.5,3,10,$symbol\n"
            import_prices(prices, IOBuffer(more("AAPL")), AssetDetails("Apple", "NASDAQ", "Acción", "USD"))
            import_prices(prices, IOBuffer(more("MSFT")), AssetDetails("Microsoft", "NASDAQ", "Acción", "USD"))
            body = response_json(call("GET", "/api/internal/portfolios/$created_id/history"))
            @test body["currency"] == "USD" && body["capital"] == 10000
            @test body["anchor_date"] == "2024-06-11"
            @test [p[1] for p in body["points"]] == ["2024-06-10", "2024-06-11"]
            @test body["points"][2][2] == 10000
            @test body["points"][1][2] ≈ 6000 * 1.5 / 3 + 4000 * 1.5 / 3
            @test call("GET", "/api/internal/portfolios/$created_id/history"; actor=admin.id).status == 404
            @test call("GET", "/api/internal/portfolios/$created_id/history"; actor=nothing).status == 403
            @test call("GET", "/api/internal/portfolios/$created_id/history"; with_key=false).status == 401
        end

        @testset "invalid portfolios are rejected" begin
            cases = [
                """{"name": "A", "capital": 1, "currency": "USD", "positions": [{"asset_id": $aapl, "weight": 0.5}]}""",
                """{"name": "A", "capital": 1, "currency": "USD", "positions": [{"asset_id": 9999, "weight": 1}]}""",
                """{"name": "", "capital": 1, "currency": "USD", "positions": [{"asset_id": $aapl, "weight": 1}]}""",
                """{"name": "A", "capital": "mucho", "currency": "USD", "positions": [{"asset_id": $aapl, "weight": 1}]}""",
                """{"name": "A", "capital": 1, "currency": "USD", "positions": []}""",
                """{"name": "A", "capital": 1, "currency": "USD", "positions": "AAPL"}""",
                """{"name": "A", "capital": 0.004, "currency": "USD", "positions": [{"asset_id": $aapl, "weight": 1}]}""",
                """{"name": "A", "capital": 1, "currency": "USD", "positions": [{"asset_id": 99999999999999999999999, "weight": 1}]}""",
            ]
            for body in cases
                response = call("POST", "/api/internal/portfolios", body)
                @test response.status == 400
                @test response_json(response)["error"] == "invalid_input"
            end
        end

        @testset "delete" begin
            @test call("DELETE", "/api/internal/portfolios/$created_id").status == 200
            @test call("GET", "/api/internal/portfolios/$created_id").status == 404
            @test call("DELETE", "/api/internal/portfolios/$created_id").status == 404
        end

        @testset "CSV upload is for admins only" begin
            upload(csv_text; actor=admin.id, extra="") = call("POST", "/api/internal/admin/prices/import",
                """{"csv": $(repr(csv_text)), "name": "Walmart de México", "market": "bmv", "category": "Acción", "currency": "MXN"$extra}"""; actor)
            good = "Date,Open,High,Low,Close,Adj Close,Volume,Symbol\n2024-06-10,70,71,69,70.5,70.1,1000,WALMEX\n2024-06-11,70,71,69,70.2,,1000,WALMEX\n2024-06-12,abc,1,1,1,1,1,WALMEX\n"
            @test upload(good; actor=beto.id).status == 403
            @test upload(good; actor=nothing).status == 403

            response = upload(good)
            @test response.status == 200
            body = response_json(response)
            @test body["symbol"] == "WALMEX" && body["status"] == "partial"
            @test body["inserted"] == 2 && body["invalid_count"] == 1
            @test body["invalid"][1]["line"] == 4
            @test any(a -> a["symbol"] == "WALMEX" && a["market"] == "BMV", response_json(call("GET", "/api/internal/assets"))["assets"])

            # Reimportar no duplica; un archivo con varios símbolos o vacío es un error de entrada.
            @test response_json(upload(good))["already_stored"] == 2
            @test upload(good * "2024-06-13,1,2,0.5,1.5,1.4,10,AMXL\n").status == 400
            @test upload("").status == 400
            @test upload("Date,Open,High,Low,Close,Volume\n2024-06-10,1,2,0.5,1.5,10\n"; extra=""", "symbol": "femsa\"""").status == 200
        end
    finally
        configure!(users=nothing, internal_key="")
    end
end

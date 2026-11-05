using Test
using HTTP
using MarkovLabBackend
using MarkovLabBackend.Api: configure!

@testset "Internal admin API" begin
    key = "k"^40
    users = InMemoryUserRepository()
    prices = InMemoryPriceRepository()
    admin = sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana"))
    set_user_role(users, admin.id, :admin)
    plain = sync_google_user(users, GoogleProfile("sub-2", "beto@example.com", "Beto"))
    import_prices(prices, IOBuffer("Date,Open,High,Low,Close,Volume,Symbol\n2024-06-10,1,2,0.5,1.5,10,AAPL\n"),
                  AssetDetails("Apple", "NASDAQ", "Acción", "USD"))

    configure!(users=users, prices=prices, internal_key=key)
    call(method, path, body=nothing; actor=admin.id, with_key=true) = begin
        headers = Pair{String,String}[]
        with_key && push!(headers, "X-Internal-Key" => key)
        actor === nothing || push!(headers, "X-Actor-Id" => actor)
        api_request(method, path, body; headers)
    end
    try
        @testset "sign-in returns the role" begin
            body = response_json(call("POST", "/api/internal/users/google",
                                      """{"google_sub": "sub-2", "email": "beto@example.com", "name": "Beto"}"""; actor=nothing))
            @test body["role"] == "user"
        end

        @testset "GET /api/internal/users/{id} refreshes the session" begin
            body = response_json(call("GET", "/api/internal/users/$(admin.id)"; actor=nothing))
            @test body["role"] == "admin"
            @test body["email"] == "ana@example.com"
            @test call("GET", "/api/internal/users/00000000-0000-4000-8000-000000000000"; actor=nothing).status == 404
            @test call("GET", "/api/internal/users/$(admin.id)"; actor=nothing, with_key=false).status == 401
        end

        admin_routes = ["/api/internal/admin/summary", "/api/internal/admin/assets",
                        "/api/internal/admin/imports", "/api/internal/admin/users"]

        @testset "admin routes reject a missing key, a missing actor and a plain user" begin
            for path in admin_routes
                @test call("GET", path; with_key=false).status == 401
                missing_actor = call("GET", path; actor=nothing)
                @test missing_actor.status == 403
                @test response_json(missing_actor)["error"] == "forbidden"
                @test call("GET", path; actor=plain.id).status == 403
                @test call("GET", path; actor="not-a-uuid").status == 403
            end
        end

        @testset "admin routes return data for an admin" begin
            summary = response_json(call("GET", "/api/internal/admin/summary"))
            @test summary["users"] == 2 && summary["admins"] == 1
            @test summary["assets"] == 1 && summary["price_rows"] == 1
            @test summary["last_import"]["status"] == "success"

            assets = response_json(call("GET", "/api/internal/admin/assets"))["assets"]
            @test only(assets)["symbol"] == "AAPL"
            @test only(assets)["price_rows"] == 1
            @test only(assets)["first_date"] == "2024-06-10"

            imports = response_json(call("GET", "/api/internal/admin/imports?limit=5"))["imports"]
            @test only(imports)["status"] == "success"
            @test call("GET", "/api/internal/admin/imports?limit=abc").status == 400

            listed = response_json(call("GET", "/api/internal/admin/users"))["users"]
            @test sort([u["email"] for u in listed]) == ["ana@example.com", "beto@example.com"]
        end

        @testset "PUT /api/internal/admin/users/{id}/role" begin
            path = "/api/internal/admin/users/$(plain.id)/role"
            @test call("PUT", path, """{"role": "admin"}"""; actor=plain.id).status == 403

            promoted = call("PUT", path, """{"role": "admin"}""")
            @test promoted.status == 200
            @test response_json(promoted)["role"] == "admin"
            @test response_json(call("PUT", path, """{"role": "user"}"""))["role"] == "user"

            last_admin = call("PUT", "/api/internal/admin/users/$(admin.id)/role", """{"role": "user"}""")
            @test last_admin.status == 409
            @test response_json(last_admin)["error"] == "last_admin"

            @test call("PUT", path, """{"role": "root"}""").status == 400
            @test call("PUT", path, """{}""").status == 400
            @test call("PUT", "/api/internal/admin/users/00000000-0000-4000-8000-000000000000/role",
                       """{"role": "admin"}""").status == 404
        end
    finally
        configure!(users=nothing, internal_key="")
    end
end

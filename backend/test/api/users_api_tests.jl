using Test
using HTTP
using MarkovLabBackend
using MarkovLabBackend.Api: configure!

@testset "POST /api/internal/users/google" begin
    key = "k"^40
    path = "/api/internal/users/google"
    payload = """{"google_sub": "sub-1", "email": "Ana@Example.com", "name": "Ana"}"""
    request(body=payload; headers=["X-Internal-Key" => key]) = api_request("POST", path, body; headers)

    @testset "disabled until a key and a repository are configured" begin
        configure!(users=nothing, internal_key="")
        response = request()
        @test response.status == 503
        @test response_json(response)["error"] == "not_configured"

        configure!(users=nothing, internal_key=key)
        @test request().status == 503
    end

    users = InMemoryUserRepository()
    configure!(users=users, internal_key=key)
    try
        @testset "rejects a missing or wrong key before reading the body" begin
            for headers in (Pair{String,String}[], ["X-Internal-Key" => "wrong"], ["X-Internal-Key" => key * "x"])
                response = request("{not json"; headers)
                @test response.status == 401
                @test response_json(response)["error"] == "unauthorized"
            end
            @test isempty(users.by_subject)
        end

        @testset "creates and then updates the user" begin
            response = request()
            @test response.status == 200
            body = response_json(response)
            @test body["email"] == "ana@example.com"
            @test body["display_name"] == "Ana"
            @test !isempty(body["id"])

            again = response_json(request("""{"google_sub": "sub-1", "email": "ana@example.com", "name": null}"""))
            @test again["id"] == body["id"]
            @test again["display_name"] === nothing
            @test length(users.by_subject) == 1
        end

        @testset "invalid input and conflicts" begin
            cases = [
                ("{not json", 400, "invalid_json"),
                ("""{"email": "a@b.co"}""", 400, "invalid_input"),
                ("""{"google_sub": 5, "email": "a@b.co"}""", 400, "invalid_input"),
                ("""{"google_sub": "s", "email": "bad"}""", 400, "invalid_input"),
                ("""{"google_sub": "sub-2", "email": "ANA@example.com"}""", 409, "email_conflict"),
            ]
            for (body, status, code) in cases
                response = request(body)
                @test response.status == status
                @test response_json(response)["error"] == code
            end
        end
    finally
        configure!(users=nothing, internal_key="")
    end
end

using Test
using MarkovLabBackend

@testset "MarkovLabBackend" begin
    @test nameof(MarkovLabBackend) == :MarkovLabBackend

    @testset "the precompile workload leaves no state behind" begin
        # La precompilación configura la API con datos en memoria: nada de eso puede quedar
        # guardado en la imagen. Va primero, antes de que otra prueba llame a `configure!`.
        api = MarkovLabBackend.Api
        @test api.USERS[] === nothing && api.PRICES[] === nothing
        @test api.PORTFOLIOS[] === nothing && api.SIMULATIONS[] === nothing
        @test api.INTERNAL_KEY[] == ""
    end

    @testset "the precompile workload exercises every main route successfully" begin
        statuses = MarkovLabBackend.precompile_workload()
        @test length(statuses) == 9
        @test all(code in (200, 201) for (_, code) in statuses)
        @test MarkovLabBackend.Api.USERS[] === nothing && MarkovLabBackend.Api.INTERNAL_KEY[] == ""
    end

    include("domain/metrics_tests.jl")
    include("domain/prices_tests.jl")
    include("domain/portfolio_tests.jl")
    include("domain/simulation_tests.jl")
    include("domain/portfolio_history_tests.jl")
    include("domain/exchange_rates_tests.jl")
    include("services/services_tests.jl")
    include("services/users_tests.jl")
    include("services/prices_import_tests.jl")
    include("services/roles_tests.jl")
    include("services/portfolios_tests.jl")
    include("services/market_sync_tests.jl")
    include("services/portfolio_simulations_tests.jl")
    include("api/api_tests.jl")
    include("api/users_api_tests.jl")
    include("api/admin_api_tests.jl")
    include("api/portfolios_api_tests.jl")
    include("api/simulations_api_tests.jl")
    include("infrastructure/csv_prices_tests.jl")
    include("infrastructure/apify_market_data_tests.jl")
    include("infrastructure/postgres_connection_tests.jl")
    include("infrastructure/postgres_users_tests.jl")
    include("infrastructure/postgres_prices_tests.jl")
    include("infrastructure/postgres_portfolios_tests.jl")
    include("infrastructure/postgres_simulations_tests.jl")
end

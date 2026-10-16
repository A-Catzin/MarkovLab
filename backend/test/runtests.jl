using Test
using MarkovLabBackend

@testset "MarkovLabBackend" begin
    @test nameof(MarkovLabBackend) == :MarkovLabBackend

    include("domain/metrics_tests.jl")
    include("domain/prices_tests.jl")
    include("infrastructure/csv_prices_tests.jl")
end

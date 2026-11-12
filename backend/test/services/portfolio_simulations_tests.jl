using Test
using Dates
using MarkovLabBackend

# Dos activos con 300 días hábiles de precios (cierre ajustado), una cartera de Ana y Beto sin carteras.
function simulation_fixture()
    users = InMemoryUserRepository()
    prices = InMemoryPriceRepository()
    days = [d for d in Date(2023, 1, 2):Day(1):Date(2024, 6, 28) if dayofweek(d) <= 5][1:300]
    function load(symbol, drift)
        closes = [100 * (1 + drift)^i * (1 + 0.01 * sin(i)) for i in eachindex(days)]
        bars = [PriceBar(symbol, d, c, c * 1.01, c * 0.99, c, 1000, c) for (d, c) in zip(days, closes)]
        first(save_price_import(prices, symbol, AssetDetails(symbol, "NASDAQ", "Acción", "USD"), bars, :success, 0,
                                nothing; source=:api))
    end
    a, b = load("AAA", 0.001), load("BBB", 0.0005)
    ana = sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana"))
    beto = sync_google_user(users, GoogleProfile("sub-2", "beto@example.com", "Beto"))
    portfolios = InMemoryPortfolioRepository(prices)
    saved = create_user_portfolio(users, portfolios, ana.id,
                                  PortfolioDraft("Mixta", 10_000, "USD", [PositionDraft(a, 0.6), PositionDraft(b, 0.4)]))
    return (; users, prices, portfolios, simulations=InMemorySimulationRepository(), ana, beto, saved, days)
end

@testset "Portfolio simulations" begin
    @testset "a user simulates their portfolio with stored prices and the result is saved" begin
        f = simulation_fixture()
        sim = simulate_user_portfolio(f.users, f.portfolios, f.prices, f.simulations, f.ana.id, f.saved.id;
                                      horizon=21, simulations=2_000, confidence=0.95, lookback_years=5, seed=42)
        @test sim.portfolio_id == f.saved.id
        @test sim.model == MONTE_CARLO_MODEL
        @test (sim.horizon, sim.simulations, sim.confidence, sim.seed) == (21, 2_000, 0.95, 42)
        @test sim.symbols == ["AAA", "BBB"] && sim.weights == [0.6, 0.4]
        # 300 días de precios dan 300 observaciones dentro de la ventana de 5 años.
        @test sim.observations == 300
        @test sim.window == (f.days[1], f.days[end])
        @test sim.value_at_risk <= sim.conditional_value_at_risk
        @test sim.expected_volatility > 0
        @test sort(collect(keys(sim.summary["percentiles"]))) == sort(["1", "5", "25", "50", "75", "95", "99"])
        @test sim.summary["scenarios"] == 2_000
        # Misma semilla, mismo resultado (RNF-16).
        again = simulate_user_portfolio(f.users, f.portfolios, f.prices, f.simulations, f.ana.id, f.saved.id;
                                        horizon=21, simulations=2_000, confidence=0.95, lookback_years=5, seed=42)
        @test again.summary == sim.summary && again.id != sim.id
        listed = list_user_simulations(f.users, f.portfolios, f.simulations, f.ana.id, f.saved.id)
        @test [s.id for s in listed] == [again.id, sim.id]
    end

    @testset "the estimation window is counted back from the last common price" begin
        f = simulation_fixture()
        sim = simulate_user_portfolio(f.users, f.portfolios, f.prices, f.simulations, f.ana.id, f.saved.id;
                                      horizon=1, simulations=100, lookback_years=1, seed=1)
        @test sim.window[2] == f.days[end]
        @test sim.window[1] >= f.days[end] - Year(1)
        @test sim.observations < 300
    end

    @testset "nobody else simulates or sees the simulations" begin
        f = simulation_fixture()
        simulate_user_portfolio(f.users, f.portfolios, f.prices, f.simulations, f.ana.id, f.saved.id; horizon=1, simulations=10, seed=1)
        @test simulate_user_portfolio(f.users, f.portfolios, f.prices, f.simulations, f.beto.id, f.saved.id;
                                      horizon=1, simulations=10) === nothing
        @test list_user_simulations(f.users, f.portfolios, f.simulations, f.beto.id, f.saved.id) === nothing
        @test_throws ForbiddenError simulate_user_portfolio(f.users, f.portfolios, f.prices, f.simulations, nothing,
                                                            f.saved.id; horizon=1, simulations=10)
    end

    @testset "invalid requests and short histories" begin
        f = simulation_fixture()
        run(; kwargs...) = simulate_user_portfolio(f.users, f.portfolios, f.prices, f.simulations, f.ana.id, f.saved.id;
                                                   simulations=10, kwargs...)
        @test_throws ArgumentError run(horizon=0)
        @test_throws ArgumentError run(horizon=1, confidence=1.0)
        @test_throws ArgumentError run(horizon=1, lookback_years=0)
        @test_throws ArgumentError run(horizon=1, lookback_years=21)
        @test isempty(list_user_simulations(f.users, f.portfolios, f.simulations, f.ana.id, f.saved.id))
        # Un activo con pocos días de precios no alcanza para estimar.
        bars = [PriceBar("CCC", Date(2024, 6, d), 10, 11, 9, 10, 1, 10) for d in 3:7]
        c = first(save_price_import(f.prices, "CCC", AssetDetails("C", "NASDAQ", "Acción", "USD"), bars, :success, 0,
                                    nothing; source=:api))
        short = create_user_portfolio(f.users, f.portfolios, f.ana.id,
                                      PortfolioDraft("Corta", 1, "USD", [PositionDraft(c, 1.0)]))
        @test_throws InsufficientDataError simulate_user_portfolio(f.users, f.portfolios, f.prices, f.simulations,
                                                                   f.ana.id, short.id; horizon=1, simulations=10)
    end
end

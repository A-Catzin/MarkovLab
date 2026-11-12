using Test
using Dates
using LibPQ
using MarkovLabBackend

# Integración contra un PostgreSQL real con el esquema oficial y las migraciones aplicadas.
# Solo corre si se define TEST_DATABASE_URL; al final borra lo que creó.
@testset "PostgresSimulationRepository" begin
    url = Base.get(ENV, "TEST_DATABASE_URL", "")
    if isempty(url)
        @info "TEST_DATABASE_URL is not set; skipping PostgreSQL simulation tests"
        @test_skip false
    else
        users = PostgresUserRepository(url)
        prices = PostgresPriceRepository(url)
        portfolios = PostgresPortfolioRepository(url)
        simulations = PostgresSimulationRepository(url)
        try
            days = [Date(2024, 1, 1) + Day(i) for i in 0:89]
            ids = map(("ITSA", "ITSB")) do symbol
                bars = [PriceBar(symbol, d, 50 + i + cos(i), 52 + i + cos(i), 48 + i + cos(i), 50 + i + cos(i), 5)
                        for (i, d) in enumerate(days)]
                first(save_price_import(prices, symbol, AssetDetails(symbol, "TEST-SIM", "Acción", "USD"), bars,
                                        :success, 0, nothing; source=:api))
            end
            ana = sync_google_user(users, GoogleProfile("it-sim-1", "it.sim1@example.com", "Ana"))
            beto = sync_google_user(users, GoogleProfile("it-sim-2", "it.sim2@example.com", "Beto"))
            saved = create_user_portfolio(users, portfolios, ana.id,
                                          PortfolioDraft("Sim", 1_000, "USD", [PositionDraft(ids[1], 0.7), PositionDraft(ids[2], 0.3)]))

            sim = simulate_user_portfolio(users, portfolios, prices, simulations, ana.id, saved.id;
                                          horizon=63, simulations=1_000, confidence=0.95, seed=11)
            @test length(sim.id) == 36 && sim.created_at isa String
            @test sim.observations == 90 && sim.window == (days[1], days[end])
            listed = list_user_simulations(users, portfolios, simulations, ana.id, saved.id)
            # Lo que se lee de la base es lo mismo que se guardó, incluido el resumen completo.
            @test only(listed) == sim
            @test list_user_simulations(users, portfolios, simulations, beto.id, saved.id) === nothing

            conn = MarkovLabBackend.connection!(simulations)
            row = LibPQ.columntable(LibPQ.execute(conn,
                "SELECT modelo, num_simulaciones, horizonte, semilla, activos::text AS activos, valor_en_riesgo FROM simulaciones WHERE id = \$1::uuid",
                [sim.id]; throw_error=true))
            @test only(row.modelo) == MONTE_CARLO_MODEL && only(row.num_simulaciones) == 1_000
            @test only(row.horizonte) == 63 && only(row.semilla) == 11
            @test occursin("ITSA", only(row.activos)) && only(row.valor_en_riesgo) ≈ sim.value_at_risk

            # Borrar la cartera deja la simulación sin cartera (ON DELETE SET NULL): ya no aparece en su lista.
            delete_user_portfolio(users, portfolios, ana.id, saved.id)
            @test only(LibPQ.columntable(LibPQ.execute(conn, "SELECT cartera_id IS NULL AS sin FROM simulaciones WHERE id = \$1::uuid",
                                                       [sim.id])).sin)
        finally
            conn = MarkovLabBackend.connection!(simulations)
            LibPQ.execute(conn, "DELETE FROM carteras WHERE usuario_id IN (SELECT id FROM usuarios WHERE google_sub IN ('it-sim-1', 'it-sim-2'))")
            LibPQ.execute(conn, "DELETE FROM usuarios WHERE google_sub IN ('it-sim-1', 'it-sim-2')")
            LibPQ.execute(conn, "DELETE FROM sincronizaciones WHERE activo_id IN (SELECT id FROM activos WHERE mercado = 'TEST-SIM')")
            LibPQ.execute(conn, "DELETE FROM activos WHERE mercado = 'TEST-SIM'")
            foreach(close, (users, prices, portfolios, simulations))
        end
    end
end

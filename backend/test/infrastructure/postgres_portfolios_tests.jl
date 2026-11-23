using Test
using LibPQ
using MarkovLabBackend

# Integración contra un PostgreSQL real con el esquema oficial y las migraciones aplicadas.
# Solo corre si se define TEST_DATABASE_URL; al final borra lo que creó.
@testset "PostgresPortfolioRepository" begin
    url = Base.get(ENV, "TEST_DATABASE_URL", "")
    if isempty(url)
        @info "TEST_DATABASE_URL is not set; skipping PostgreSQL portfolio tests"
        @test_skip false
    else
        users = PostgresUserRepository(url)
        prices = PostgresPriceRepository(url)
        portfolios = PostgresPortfolioRepository(url)
        csv(symbol) = "Date,Open,High,Low,Close,Volume,Symbol\n2024-06-10,1,2,0.5,1.5,10,$symbol\n"
        try
            aapl = import_prices(prices, IOBuffer(csv("ITPA")), AssetDetails("Prueba A", "TEST-PF", "Acción", "USD")).asset_id
            msft = import_prices(prices, IOBuffer(csv("ITPB")), AssetDetails("Prueba B", "TEST-PF", "ETF", "USD")).asset_id
            ana = sync_google_user(users, GoogleProfile("it-pf-1", "it.pf1@example.com", "Ana"))
            beto = sync_google_user(users, GoogleProfile("it-pf-2", "it.pf2@example.com", "Beto"))

            # Pesos con dos decimales en porcentaje: se guardan exactos (numeric(9, 8)).
            draft = PortfolioDraft("Mixta", 12_345.67, "usd", [PositionDraft(aapl, 0.3333), PositionDraft(msft, 0.6667)])
            created = create_user_portfolio(users, portfolios, ana.id, draft)
            @test length(created.id) == 36
            @test created.capital == 12_345.67
            @test created.currency == "USD" && created.status == :draft
            @test created.created_at isa String && endswith(created.created_at, "Z")
            @test [(p.symbol, p.weight) for p in created.positions] == [("ITPB", 0.6667), ("ITPA", 0.3333)]
            @test created.positions[1].name == "Prueba B" && created.positions[1].market == "TEST-PF"

            @test [p.id for p in list_user_portfolios(users, portfolios, ana.id)] == [created.id]
            @test isempty(list_user_portfolios(users, portfolios, beto.id))
            @test get_user_portfolio(users, portfolios, ana.id, created.id) == created
            # Otro usuario no la ve ni la borra.
            @test get_user_portfolio(users, portfolios, beto.id, created.id) === nothing
            @test delete_user_portfolio(users, portfolios, beto.id, created.id) == false

            # Un activo inexistente no deja nada guardado (la operación es atómica).
            bad = PortfolioDraft("Mala", 1, "USD", [PositionDraft(aapl, 0.5), PositionDraft(987654321, 0.5)])
            @test_throws ArgumentError create_user_portfolio(users, portfolios, ana.id, bad)
            @test length(list_user_portfolios(users, portfolios, ana.id)) == 1

            @testset "version snapshot and position failures are atomic" begin
                M = MarkovLabBackend
                conn = M.connection!(portfolios)
                sql(statement) = close(M.run_query(conn, statement))
                sql(raw"""
                    CREATE FUNCTION pg_temp.b3_reject_position() RETURNS trigger LANGUAGE plpgsql AS $$
                    BEGIN RAISE EXCEPTION 'b3 test: position write failed'; END;
                    $$
                    """)
                sql("CREATE TRIGGER b3_reject_position BEFORE INSERT ON posiciones_cartera " *
                    "FOR EACH ROW WHEN (NEW.activo_id = $aapl) EXECUTE FUNCTION pg_temp.b3_reject_position()")
                before = M.list_portfolio_versions(portfolios, ana.id, created.id)
                edit = PortfolioDraft("Editada", 100, "usd", [PositionDraft(aapl, 0.2), PositionDraft(msft, 0.8)])
                try
                    @test_throws "b3 test: position write failed" M.update_portfolio(portfolios, ana.id, created.id, edit)
                    @test_throws "b3 test: position write failed" M.duplicate_portfolio(portfolios, ana.id, created.id, "Copia")
                    @test get_user_portfolio(users, portfolios, ana.id, created.id) == created
                    @test M.list_portfolio_versions(portfolios, ana.id, created.id) == before
                    @test [p.id for p in list_user_portfolios(users, portfolios, ana.id)] == [created.id]
                finally
                    sql("DROP TRIGGER b3_reject_position ON posiciones_cartera")
                    sql("DROP FUNCTION pg_temp.b3_reject_position()")
                end
                second = PostgresPortfolioRepository(url)
                try
                    t1 = @async M.update_portfolio(portfolios, ana.id, created.id, edit)
                    t2 = @async M.update_portfolio(second, ana.id, created.id, draft)
                    @test all(p !== nothing for p in (fetch(t1), fetch(t2)))
                    versions = M.list_portfolio_versions(portfolios, ana.id, created.id)
                    @test [v["version_number"] for v in versions] == [3, 2, 1]
                    @test sort([v["name"] for v in versions]) == ["Editada", "Mixta", "Mixta"]
                finally
                    close(second)
                end
            end

            # Un activo con carteras no se puede borrar (ON DELETE RESTRICT); borrar la cartera borra sus posiciones.
            @test delete_user_portfolio(users, portfolios, ana.id, created.id) == true
            @test get_user_portfolio(users, portfolios, ana.id, created.id) === nothing
            conn = MarkovLabBackend.connection!(portfolios)
            @test only(LibPQ.columntable(LibPQ.execute(conn, "SELECT count(*) AS n FROM posiciones_cartera WHERE cartera_id = \$1::uuid", [created.id])).n) == 0
        finally
            conn = MarkovLabBackend.connection!(portfolios)
            LibPQ.execute(conn, "DELETE FROM carteras WHERE usuario_id IN (SELECT id FROM usuarios WHERE google_sub IN ('it-pf-1', 'it-pf-2'))")
            LibPQ.execute(conn, "DELETE FROM usuarios WHERE google_sub IN ('it-pf-1', 'it-pf-2')")
            LibPQ.execute(conn, "DELETE FROM sincronizaciones WHERE activo_id IN (SELECT id FROM activos WHERE mercado = 'TEST-PF')")
            LibPQ.execute(conn, "DELETE FROM activos WHERE mercado = 'TEST-PF'")
            foreach(close, (users, prices, portfolios))
        end
    end
end

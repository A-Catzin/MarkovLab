using Test
using Dates
using MarkovLabBackend

# Dos activos cargados en memoria, para armar carteras con ids reales.
function portfolio_fixture()
    users = InMemoryUserRepository()
    prices = InMemoryPriceRepository()
    csv(symbol) = "Date,Open,High,Low,Close,Volume,Symbol\n2024-06-10,1,2,0.5,1.5,10,$symbol\n"
    aapl = import_prices(prices, IOBuffer(csv("AAPL")), AssetDetails("Apple", "NASDAQ", "Acción", "USD")).asset_id
    msft = import_prices(prices, IOBuffer(csv("MSFT")), AssetDetails("Microsoft", "NASDAQ", "Acción", "USD")).asset_id
    ana = sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana"))
    beto = sync_google_user(users, GoogleProfile("sub-2", "beto@example.com", "Beto"))
    portfolios = InMemoryPortfolioRepository(prices)
    return (; users, prices, portfolios, aapl, msft, ana, beto)
end

@testset "Portfolios" begin
    @testset "PortfolioDraft validates the form" begin
        draft = PortfolioDraft("  Mi cartera ", 10_000, "mxn", [PositionDraft(1, 0.6), PositionDraft(2, 0.4)])
        @test draft.name == "Mi cartera"
        @test draft.capital == 10_000.0
        @test draft.currency == "MXN"
        @test length(draft.positions) == 2

        @test_throws ArgumentError PortfolioDraft("", 1, "MXN", [PositionDraft(1, 1.0)])
        @test_throws ArgumentError PortfolioDraft("x"^121, 1, "MXN", [PositionDraft(1, 1.0)])
        @test_throws ArgumentError PortfolioDraft("A", 0, "MXN", [PositionDraft(1, 1.0)])
        @test_throws ArgumentError PortfolioDraft("A", -5, "MXN", [PositionDraft(1, 1.0)])
        @test_throws ArgumentError PortfolioDraft("A", Inf, "MXN", [PositionDraft(1, 1.0)])
        # Se guarda con 2 decimales: el mínimo es un centavo, así nunca queda en 0.00.
        @test_throws ArgumentError PortfolioDraft("A", 0.004, "MXN", [PositionDraft(1, 1.0)])
        @test PortfolioDraft("A", 0.01, "MXN", [PositionDraft(1, 1.0)]) isa PortfolioDraft
        @test_throws ArgumentError PortfolioDraft("A", 1, "PESOS", [PositionDraft(1, 1.0)])
        @test_throws ArgumentError PortfolioDraft("A", 1, "MXN", PositionDraft[])
        # Los pesos suman 100 % (RF-29), cada uno entre 0 y 1, sin activos repetidos.
        @test_throws ArgumentError PortfolioDraft("A", 1, "MXN", [PositionDraft(1, 0.5), PositionDraft(2, 0.4)])
        @test_throws ArgumentError PortfolioDraft("A", 1, "MXN", [PositionDraft(1, 1.2), PositionDraft(2, -0.2)])
        @test_throws ArgumentError PortfolioDraft("A", 1, "MXN", [PositionDraft(1, 0.5), PositionDraft(1, 0.5)])
        @test_throws ArgumentError PortfolioDraft("A", 1, "MXN", [PositionDraft(0, 1.0)])
        # Pesos en porcentaje con dos decimales: 33.33 + 33.33 + 33.34 = 100.
        @test PortfolioDraft("A", 1, "MXN", [PositionDraft(1, 0.3333), PositionDraft(2, 0.3333), PositionDraft(3, 0.3334)]) isa PortfolioDraft
    end

    @testset "a user creates, lists, reads and deletes only their own portfolios" begin
        f = portfolio_fixture()
        draft = PortfolioDraft("Tecnología", 10_000, "USD", [PositionDraft(f.aapl, 0.6), PositionDraft(f.msft, 0.4)])
        created = create_user_portfolio(f.users, f.portfolios, f.ana.id, draft)
        @test created isa SavedPortfolio
        @test created.name == "Tecnología" && created.capital == 10_000.0 && created.status == :draft
        @test [(p.symbol, p.weight) for p in created.positions] == [("AAPL", 0.6), ("MSFT", 0.4)]
        @test first(created.positions).name == "Apple"

        @test [p.id for p in list_user_portfolios(f.users, f.portfolios, f.ana.id)] == [created.id]
        @test isempty(list_user_portfolios(f.users, f.portfolios, f.beto.id))
        @test get_user_portfolio(f.users, f.portfolios, f.ana.id, created.id) == created

        # Beto no puede ver ni borrar la cartera de Ana: para él no existe.
        @test get_user_portfolio(f.users, f.portfolios, f.beto.id, created.id) === nothing
        @test delete_user_portfolio(f.users, f.portfolios, f.beto.id, created.id) == false
        @test get_user_portfolio(f.users, f.portfolios, f.ana.id, created.id) !== nothing

        @test delete_user_portfolio(f.users, f.portfolios, f.ana.id, created.id) == true
        @test get_user_portfolio(f.users, f.portfolios, f.ana.id, created.id) === nothing
        @test get_user_portfolio(f.users, f.portfolios, f.ana.id, "not-a-uuid") === nothing
    end

    @testset "unknown users and unknown assets are rejected" begin
        f = portfolio_fixture()
        draft = PortfolioDraft("A", 1, "USD", [PositionDraft(f.aapl, 1.0)])
        @test_throws ForbiddenError create_user_portfolio(f.users, f.portfolios, "00000000-0000-4000-8000-000000000000", draft)
        @test_throws ForbiddenError list_user_portfolios(f.users, f.portfolios, nothing)
        missing_asset = PortfolioDraft("A", 1, "USD", [PositionDraft(f.aapl, 0.5), PositionDraft(9999, 0.5)])
        err = try
            create_user_portfolio(f.users, f.portfolios, f.ana.id, missing_asset)
            nothing
        catch e
            e
        end
        @test err isa ArgumentError
        @test occursin("9999", err.msg)
        @test isempty(list_user_portfolios(f.users, f.portfolios, f.ana.id))
    end

    @testset "history of a portfolio, only for its owner" begin
        f = portfolio_fixture()
        more(symbol, rows) = import_prices(f.prices, IOBuffer("Date,Open,High,Low,Close,Adj Close,Volume,Symbol\n" * rows),
                                           AssetDetails("x", "NASDAQ", "Acción", "USD"))
        more("AAPL", "2024-06-11,1,4,0.5,3,3,10,AAPL\n")
        more("MSFT", "2024-06-11,1,2,0.5,1.5,1.5,10,MSFT\n")
        saved = create_user_portfolio(f.users, f.portfolios, f.ana.id,
                                      PortfolioDraft("A", 1000, "USD", [PositionDraft(f.aapl, 0.5), PositionDraft(f.msft, 0.5)]))
        history = user_portfolio_history(f.users, f.portfolios, f.prices, f.ana.id, saved.id)
        @test history.dates == [Date(2024, 6, 10), Date(2024, 6, 11)]
        # Creada hoy, después del último precio: vale el capital el 2024-06-11.
        @test history.anchor == Date(2024, 6, 11)
        @test history.values ≈ [500 * 1.5 / 3 + 500, 1000.0]
        @test user_portfolio_history(f.users, f.portfolios, f.prices, f.beto.id, saved.id) === nothing
        @test_throws ForbiddenError user_portfolio_history(f.users, f.portfolios, f.prices, nothing, saved.id)
    end
end

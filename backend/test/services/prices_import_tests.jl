using Test
using Dates
using MarkovLabBackend

const VALID_CSV = """
Date,Open,High,Low,Close,Adj Close,Volume,Symbol
2024-06-10,192.50,194.80,191.20,193.75,193.75,48215000,aapl
2024-06-11,193.00,195.00,192.00,194.50,194.50,40000000,AAPL
2024-06-12,194.50,196.00,193.50,195.80,195.80,41000000,AAPL
"""

apple() = AssetDetails("Apple Inc.", "NASDAQ", "Acción", "usd")

@testset "Price import" begin
    @testset "AssetDetails validates and normalizes" begin
        details = apple()
        @test details.name == "Apple Inc."
        @test details.market == "NASDAQ"
        @test details.category == "Acción"
        @test details.currency == "USD"
        # El mercado se guarda siempre en mayúsculas: NASDAQ y nasdaq son el mismo mercado.
        @test AssetDetails("  Apple  ", " nasdaq ", " acción ", " mxn ").market == "NASDAQ"

        @test_throws ArgumentError AssetDetails("", "NASDAQ", "Acción", "USD")
        @test_throws ArgumentError AssetDetails("Apple", "  ", "Acción", "USD")
        @test_throws ArgumentError AssetDetails("Apple", "NASDAQ", "", "USD")
        @test_throws ArgumentError AssetDetails("Apple", "NASDAQ", "Acción", "US")
        @test_throws ArgumentError AssetDetails("Apple", "NASDAQ", "Acción", "U5D")
        @test_throws ArgumentError AssetDetails("Apple\0", "NASDAQ", "Acción", "USD")
    end

    @testset "a clean file is stored and reimporting it adds nothing" begin
        prices = InMemoryPriceRepository()
        first_run = import_prices(prices, IOBuffer(VALID_CSV), apple())
        @test first_run.status == :success
        @test first_run.symbol == "AAPL"
        @test first_run.valid_rows == 3
        @test first_run.inserted == 3
        @test first_run.already_stored == 0
        @test isempty(first_run.invalid) && isempty(first_run.file_duplicates)
        @test first_run.asset_id isa Int
        @test length(prices.bars) == 3

        # Volver a importar el mismo archivo no duplica precios (RF-05).
        again = import_prices(prices, IOBuffer(VALID_CSV), apple())
        @test again.asset_id == first_run.asset_id
        @test again.inserted == 0
        @test again.already_stored == 3
        @test length(prices.bars) == 3

        # Cada corrida queda registrada en sincronizaciones (RF-06).
        @test length(prices.syncs) == 2
        @test prices.syncs[1].status == :success && prices.syncs[1].saved == 3 && prices.syncs[1].failed == 0
        @test prices.syncs[2].saved == 0
        @test only(values(prices.assets)).details == apple()
        # El cierre ajustado del archivo se guarda junto con el resto de la barra.
        @test sort([b.adj_close for b in values(prices.bars)]) == [193.75, 194.5, 195.8]
    end

    @testset "invalid rows make the import partial; duplicates inside the file are skipped" begin
        csv = VALID_CSV * """
        2024-06-13,190.00,189.00,188.00,189.50,189.50,1000,AAPL
        2024-06-14,abc,1,1,1,1,1,AAPL
        2024-06-10,192.50,194.80,191.20,193.75,193.75,48215000,AAPL
        """
        prices = InMemoryPriceRepository()
        summary = import_prices(prices, IOBuffer(csv), apple())
        @test summary.status == :partial
        @test summary.inserted == 3
        @test length(summary.invalid) == 2
        @test length(summary.file_duplicates) == 1
        @test prices.syncs[1].status == :partial
        @test prices.syncs[1].failed == 2
        @test occursin("2 invalid rows", prices.syncs[1].message)
    end

    @testset "a file without valid rows fails and stores no prices" begin
        prices = InMemoryPriceRepository()
        csv = "Date,Open,High,Low,Close,Volume,Symbol\n2024-06-13,190.00,189.00,188.00,189.50,1000,AAPL\n"
        summary = import_prices(prices, IOBuffer(csv), apple())
        @test summary.status == :failed
        @test summary.asset_id === nothing
        @test summary.inserted == 0
        @test isempty(prices.bars) && isempty(prices.assets)
        @test prices.syncs[1].status == :failed
        @test prices.syncs[1].asset_id === nothing
    end

    @testset "one asset per file" begin
        prices = InMemoryPriceRepository()
        mixed = VALID_CSV * "2024-06-13,400,405,398,404,404,800,MSFT\n"
        err = try
            import_prices(prices, IOBuffer(mixed), apple())
            nothing
        catch e
            e
        end
        @test err isa ArgumentError
        @test occursin("AAPL, MSFT", err.msg)
        @test isempty(prices.syncs)

        # Sin columna de símbolo, se usa el que se indique; con columna, deben coincidir.
        no_symbol = "Date,Open,High,Low,Close,Volume\n2024-06-10,1,2,0.5,1.5,10\n"
        @test import_prices(prices, IOBuffer(no_symbol), apple(); symbol="wmt").symbol == "WMT"
        @test_throws ArgumentError import_prices(prices, IOBuffer(no_symbol), apple())
        @test_throws ArgumentError import_prices(prices, IOBuffer(VALID_CSV), apple(); symbol="MSFT")
    end
end

using Test
using Dates
using LibPQ
using MarkovLabBackend

# Integración contra un PostgreSQL real con el esquema oficial (database/migrations/esquema.sql).
# Solo corre si se define TEST_DATABASE_URL; al final borra lo que creó.
@testset "PostgresPriceRepository" begin
    url = Base.get(ENV, "TEST_DATABASE_URL", "")
    if isempty(url)
        @info "TEST_DATABASE_URL is not set; skipping PostgreSQL price import tests"
        @test_skip false
    else
        prices = PostgresPriceRepository(url)
        conn = MarkovLabBackend.connection!(prices)
        query(sql, params=[]) = LibPQ.columntable(LibPQ.execute(conn, sql, params; throw_error=true))
        details = AssetDetails("Prueba Integración", "TEST-MKT", "Acción", "MXN")
        csv = """
        Date,Open,High,Low,Close,Adj Close,Volume,Symbol
        2024-06-10,192.5,194.8,191.2,193.75,193.75,48215000,ITST
        2024-06-11,193,195,192,194.5,194.5,40000000,ITST
        2024-06-12,abc,1,1,1,1,1,ITST
        """
        try
            first_run = import_prices(prices, IOBuffer(csv), details)
            @test first_run.status == :partial
            @test first_run.inserted == 2
            @test first_run.asset_id isa Int

            asset = query("SELECT simbolo, nombre, mercado, categoria, moneda, ultima_sincronizacion FROM activos WHERE id = \$1",
                          [first_run.asset_id])
            @test only(asset.simbolo) == "ITST"
            @test only(asset.moneda) == "MXN"
            @test !ismissing(only(asset.ultima_sincronizacion))

            stored = query("SELECT fecha_operacion, origen, cierre, cierre_ajustado, volumen FROM precios_historicos WHERE activo_id = \$1 ORDER BY fecha_operacion",
                           [first_run.asset_id])
            @test stored.cierre_ajustado == [193.75, 194.5]
            @test stored.fecha_operacion == [Date(2024, 6, 10), Date(2024, 6, 11)]
            @test all(==("csv"), stored.origen)
            @test stored.cierre == [193.75, 194.5]
            @test stored.volumen == [48215000.0, 40000000.0]

            # Reimportar no duplica (RF-05) y actualiza los datos descriptivos del activo.
            renamed = AssetDetails("Prueba Renombrada", "TEST-MKT", "ETF", "USD")
            again = import_prices(prices, IOBuffer(csv), renamed)
            @test again.asset_id == first_run.asset_id
            @test again.inserted == 0 && again.already_stored == 2
            @test only(query("SELECT count(*) AS n FROM precios_historicos WHERE activo_id = \$1", [first_run.asset_id]).n) == 2
            @test only(query("SELECT nombre FROM activos WHERE id = \$1", [first_run.asset_id]).nombre) == "Prueba Renombrada"

            # Cada corrida queda en sincronizaciones con su estado final (RF-06).
            syncs = query("SELECT estado, registros_guardados, registros_fallidos, mensaje_error, finalizado_en FROM sincronizaciones WHERE activo_id = \$1 ORDER BY id",
                          [first_run.asset_id])
            @test syncs.estado == ["parcial", "parcial"]
            @test syncs.registros_guardados == [2, 0]
            @test syncs.registros_fallidos == [1, 1]
            @test occursin("1 invalid rows", first(syncs.mensaje_error))
            @test all(!ismissing, syncs.finalizado_en)

            # Un archivo sin filas válidas queda como fallida y no crea activos.
            failed = import_prices(prices, IOBuffer("Date,Open,High,Low,Close,Volume,Symbol\n2024-06-13,1,0.5,1,1,1,NOPE\n"), details)
            @test failed.status == :failed && failed.asset_id === nothing
            @test isempty(query("SELECT id FROM activos WHERE simbolo = 'NOPE'").id)
            @test only(query("SELECT estado FROM sincronizaciones WHERE activo_id IS NULL ORDER BY id DESC LIMIT 1").estado) == "fallida"

            # Si la conexión se corta, la transacción completa se reintenta una vez.
            pid = only(query("SELECT pg_backend_pid() AS pid").pid)
            admin = LibPQ.Connection(url)
            LibPQ.execute(admin, "SELECT pg_terminate_backend(\$1)", [pid])
            close(admin)
            more = csv * "2024-06-13,195,196,194,195.5,195.5,1000,ITST\n"
            after_cut = import_prices(prices, IOBuffer(more), details)
            @test after_cut.inserted == 1
            conn = MarkovLabBackend.connection!(prices)
        finally
            conn = MarkovLabBackend.connection!(prices)
            LibPQ.execute(conn, "DELETE FROM sincronizaciones WHERE activo_id IN (SELECT id FROM activos WHERE mercado = 'TEST-MKT') OR (activo_id IS NULL AND mensaje_error LIKE 'no valid rows%')")
            LibPQ.execute(conn, "DELETE FROM activos WHERE mercado = 'TEST-MKT'")
            close(prices)
        end
    end
end

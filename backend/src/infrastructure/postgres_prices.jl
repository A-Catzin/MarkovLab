"""
    PostgresPriceRepository(url)

Adaptador de precios sobre PostgreSQL (tablas `activos`, `precios_historicos` y
`sincronizaciones`, con nombres en español). Cada importación corre en una sola
transacción: o se guardan el activo, los precios y el registro, o no se guarda nada.
"""
struct PostgresPriceRepository <: PriceRepository
    db::PostgresConnection
end

PostgresPriceRepository(url::AbstractString) = PostgresPriceRepository(PostgresConnection(url))

connection!(prices::PostgresPriceRepository) = connection!(prices.db)
Base.close(prices::PostgresPriceRepository) = close(prices.db)

# Estados de la importación en el enum `estado_sincronizacion` de la base.
const SYNC_STATUS_VALUES = Dict(:success => "exitosa", :partial => "parcial", :failed => "fallida")

# Busca el activo por mercado y símbolo (SRS 7.2) sin depender de que exista un índice único.
const FIND_ASSET_SQL = "SELECT id FROM activos WHERE mercado = \$1 AND simbolo = \$2"

const INSERT_ASSET_SQL = """
    INSERT INTO activos (simbolo, nombre, mercado, categoria, moneda, ultima_sincronizacion, creado_en, actualizado_en)
    VALUES (\$1, \$2, \$3, \$4, \$5, now(), now(), now())
    RETURNING id
    """

# Los datos descriptivos se actualizan con los de la última importación.
const UPDATE_ASSET_SQL = """
    UPDATE activos
    SET nombre = \$2, categoria = \$3, moneda = \$4, ultima_sincronizacion = now(), actualizado_en = now()
    WHERE id = \$1
    """

# Todas las barras en una sola consulta: cada columna viaja como arreglo y `unnest` las
# vuelve filas. Las que ya existen para el mismo activo, fecha y origen se omiten (RF-05).
const INSERT_BARS_SQL = """
    INSERT INTO precios_historicos
        (activo_id, fecha_operacion, origen, apertura, maximo, minimo, cierre, cierre_ajustado, volumen, importado_en)
    SELECT \$1, t.fecha, \$9::origen_precio, t.apertura, t.maximo, t.minimo, t.cierre, t.cierre_ajustado, t.volumen, now()
    FROM unnest(\$2::date[], \$3::float8[], \$4::float8[], \$5::float8[], \$6::float8[], \$7::float8[], \$8::float8[])
        AS t(fecha, apertura, maximo, minimo, cierre, cierre_ajustado, volumen)
    ON CONFLICT (activo_id, fecha_operacion, origen) DO NOTHING
    """

# El registro se guarda ya terminado, con su estado final y la fecha de fin (RF-06).
const INSERT_SYNC_SQL = """
    INSERT INTO sincronizaciones
        (origen, activo_id, estado, registros_guardados, registros_fallidos, mensaje_error, iniciado_en, finalizado_en)
    VALUES (\$7::origen_precio, \$1, \$2::estado_sincronizacion, \$3, \$4, \$5, \$6, now())
    """

# Un precio por día: el cierre ajustado (o el cierre), y el de la API si hay de los dos orígenes.
const PRICE_HISTORY_SQL = """
    SELECT DISTINCT ON (fecha_operacion) fecha_operacion::text AS fecha, coalesce(cierre_ajustado, cierre) AS precio
    FROM precios_historicos
    WHERE activo_id = \$1
    ORDER BY fecha_operacion, (origen = 'api') DESC
    """

# Último precio de un símbolo (en cualquier mercado) con un origen dado.
const LATEST_PRICE_DATE_SQL = """
    SELECT max(p.fecha_operacion)::text AS hasta
    FROM precios_historicos p
    JOIN activos a ON a.id = p.activo_id
    WHERE a.simbolo = \$1 AND p.origen = \$2::origen_precio
    """

# Lecturas para las páginas de admin. Las fechas viajan como texto ISO (UTC) para no
# depender de la conversión de zonas horarias del cliente.
const LIST_ASSETS_SQL = """
    SELECT a.id, a.simbolo, a.nombre, a.mercado, a.categoria, a.moneda,
           to_char(a.ultima_sincronizacion AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ultima_sincronizacion,
           count(p.fecha_operacion) AS filas,
           min(p.fecha_operacion)::text AS desde,
           max(p.fecha_operacion)::text AS hasta
    FROM activos a
    LEFT JOIN precios_historicos p ON p.activo_id = a.id
    GROUP BY a.id
    ORDER BY a.mercado, a.simbolo
    """

const LIST_IMPORTS_SQL = """
    SELECT s.id, s.origen::text AS origen, s.estado::text AS estado, a.simbolo, a.mercado,
           s.registros_guardados, s.registros_fallidos, s.mensaje_error,
           to_char(s.iniciado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS iniciado_en,
           to_char(s.finalizado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS finalizado_en
    FROM sincronizaciones s
    LEFT JOIN activos a ON a.id = s.activo_id
    ORDER BY s.iniciado_en DESC, s.id DESC
    LIMIT \$1
    """

const STATUS_FROM_DB = Dict(value => key for (key, value) in SYNC_STATUS_VALUES)

# `missing` de la base → `nothing` del dominio.
orelse(value) = ismissing(value) ? nothing : value

function rows_from(result)
    try
        table = LibPQ.columntable(result)
        return [NamedTuple{keys(table)}(map(column -> column[i], values(table))) for i in eachindex(first(table))]
    finally
        close(result)
    end
end

function list_assets(prices::PostgresPriceRepository)
    rows = with_connection(conn -> rows_from(LibPQ.execute(conn, LIST_ASSETS_SQL; throw_error=true)), prices.db)
    return [(id=Int(r.id), symbol=r.simbolo, name=r.nombre, market=r.mercado, category=r.categoria,
             currency=strip(r.moneda), last_synced_at=orelse(r.ultima_sincronizacion), price_rows=Int(r.filas),
             first_date=orelse(r.desde), last_date=orelse(r.hasta)) for r in rows]
end

function list_imports(prices::PostgresPriceRepository; limit::Integer=50)
    rows = with_connection(conn -> rows_from(LibPQ.execute(conn, LIST_IMPORTS_SQL, [Int(limit)]; throw_error=true)), prices.db)
    return [(id=Int(r.id), source=Symbol(r.origen), status=STATUS_FROM_DB[r.estado], asset_symbol=orelse(r.simbolo),
             asset_market=orelse(r.mercado), saved=Int(r.registros_guardados), failed=Int(r.registros_fallidos),
             message=orelse(r.mensaje_error), started_at=orelse(r.iniciado_en), finished_at=orelse(r.finalizado_en))
            for r in rows]
end

# Arreglo literal de PostgreSQL ({a,b,NULL}) a partir de valores que no necesitan comillas:
# fechas ISO y números; `nothing` se vuelve NULL. `repr` de un Float64 conserva todos sus dígitos.
pg_array_item(value) = value === nothing ? "NULL" : value isa AbstractFloat ? repr(Float64(value)) : string(value)
pg_array(values) = "{" * join((pg_array_item(value) for value in values), ",") * "}"

function single_value(result)
    try
        return only(only(LibPQ.columntable(result)))
    finally
        close(result)
    end
end

function upsert_asset(conn, symbol::AbstractString, details::AssetDetails)
    result = LibPQ.execute(conn, FIND_ASSET_SQL, [details.market, symbol]; throw_error=true)
    # `columntable` lee del resultado sin copiarlo: se copian los ids antes de cerrarlo.
    found_ids = try
        collect(LibPQ.columntable(result).id)
    finally
        close(result)
    end
    if isempty(found_ids)
        return Int(single_value(LibPQ.execute(conn, INSERT_ASSET_SQL,
            [symbol, details.name, details.market, details.category, details.currency]; throw_error=true)))
    end
    asset_id = Int(first(found_ids))
    close(LibPQ.execute(conn, UPDATE_ASSET_SQL, [asset_id, details.name, details.category, details.currency];
                        throw_error=true))
    return asset_id
end

function insert_bars(conn, asset_id::Integer, bars::AbstractVector{PriceBar}, source::Symbol)
    params = [asset_id, pg_array(bar.date for bar in bars), pg_array(bar.open for bar in bars),
              pg_array(bar.high for bar in bars), pg_array(bar.low for bar in bars),
              pg_array(bar.close for bar in bars), pg_array(bar.adj_close for bar in bars),
              pg_array(bar.volume for bar in bars), string(source)]
    result = LibPQ.execute(conn, INSERT_BARS_SQL, params; throw_error=true)
    try
        return LibPQ.num_affected_rows(result)
    finally
        close(result)
    end
end

function save_price_import(prices::PostgresPriceRepository, symbol, details::Union{Nothing,AssetDetails},
                           bars::AbstractVector{PriceBar}, status::Symbol, failed_rows::Integer,
                           message; source::Symbol=:csv)
    check_import(details, bars, status, source)
    status_value = SYNC_STATUS_VALUES[status]
    started = Dates.now(Dates.UTC)
    # La transacción completa se puede repetir si la conexión se cortó: si falla, se revierte.
    return with_connection(prices.db) do conn
        in_transaction(conn) do
            asset_id = isempty(bars) ? nothing : upsert_asset(conn, symbol, details)
            inserted = asset_id === nothing ? 0 : insert_bars(conn, asset_id, bars, source)
            LibPQ.execute(conn, INSERT_SYNC_SQL,
                          [something(asset_id, missing), status_value, inserted, Int(failed_rows),
                           something(message, missing), string(started, "+00:00"), string(source)];
                          throw_error=true)
            (asset_id, inserted)
        end
    end
end

function latest_price_date(prices::PostgresPriceRepository, symbol::AbstractString; source::Symbol=:api)
    source in PRICE_SOURCES || throw(ArgumentError("unknown price source $source"))
    value = with_connection(prices.db) do conn
        single_value(LibPQ.execute(conn, LATEST_PRICE_DATE_SQL, [uppercase(strip(symbol)), string(source)];
                                   throw_error=true))
    end
    return ismissing(value) ? nothing : Date(value)
end

function price_history(prices::PostgresPriceRepository, asset_id::Integer)
    rows = with_connection(conn -> rows_from(LibPQ.execute(conn, PRICE_HISTORY_SQL, [Int(asset_id)]; throw_error=true)),
                           prices.db)
    return [(Date(r.fecha), Float64(r.precio)) for r in rows]
end

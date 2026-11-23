"""Persistencia del seguimiento: todas las operaciones reciben el id del usuario autenticado."""
abstract type WatchlistRepository end

struct PostgresWatchlist <: WatchlistRepository
    db::PostgresConnection
end

# Selecciona el cierre de una fecha: el mismo criterio de `price_history`.
watchlist_close_sql(condition) = """
    SELECT coalesce(cierre_ajustado, cierre) AS price, fecha_operacion AS date
    FROM precios_historicos
    WHERE activo_id = a.id AND $condition
    ORDER BY fecha_operacion DESC, (origen = 'api') DESC
    LIMIT 1
    """

# La lista trae solo los cierres de referencia, no las series completas.
const WATCHLIST_SQL = """
    SELECT a.id, a.simbolo AS symbol, a.nombre AS name, a.mercado AS market, a.moneda AS currency,
           p.price AS latest_price, p.date::text AS latest_date,
           d.price AS daily_price, w.price AS weekly_price, m.price AS monthly_price
    FROM lista_seguimiento l JOIN activos a ON a.id = l.activo_id
    LEFT JOIN LATERAL ($(watchlist_close_sql("true"))) p ON true
    LEFT JOIN LATERAL ($(watchlist_close_sql("fecha_operacion < p.date"))) d ON true
    LEFT JOIN LATERAL ($(watchlist_close_sql("fecha_operacion <= p.date - 7"))) w ON true
    LEFT JOIN LATERAL ($(watchlist_close_sql("fecha_operacion <= (p.date - interval '1 month')::date"))) m ON true
    WHERE l.usuario_id = \$1::uuid
    ORDER BY a.mercado, a.simbolo
    """

const FOLLOW_ASSET_SQL = """
    WITH added AS (
        INSERT INTO lista_seguimiento (usuario_id, activo_id)
        SELECT \$1::uuid, id FROM activos WHERE id = \$2::bigint
        ON CONFLICT (usuario_id, activo_id) DO NOTHING
    )
    SELECT EXISTS (SELECT 1 FROM activos WHERE id = \$2::bigint)
    """

function watchlist_changes(latest, daily, weekly, monthly)
    change(reference) = (latest === nothing || reference === nothing) ? nothing : latest / reference - 1
    return (; daily=change(daily), weekly=change(weekly), monthly=change(monthly))
end

function watched_assets(repo::PostgresWatchlist, user_id)
    rows = with_connection(conn -> rows_from(run_query(conn, WATCHLIST_SQL, [user_id])), repo.db)
    return [(; id=Int(r.id), r.symbol, r.name, r.market, currency=strip(r.currency),
              latest_price=orelse(r.latest_price), latest_date=orelse(r.latest_date),
              changes=watchlist_changes(orelse(r.latest_price), orelse(r.daily_price),
                                        orelse(r.weekly_price), orelse(r.monthly_price))) for r in rows]
end

watchlist_value(repo::PostgresWatchlist, sql, user_id, asset_id) =
    with_connection(conn -> single_value(run_query(conn, sql, [user_id, string(asset_id)])), repo.db)

follow_asset(repo::PostgresWatchlist, user_id, asset_id) = watchlist_value(repo, FOLLOW_ASSET_SQL, user_id, asset_id)
is_followed(repo::PostgresWatchlist, user_id, asset_id) = watchlist_value(repo,
    "SELECT EXISTS (SELECT 1 FROM lista_seguimiento WHERE usuario_id = \$1::uuid AND activo_id = \$2::bigint)",
    user_id, asset_id)
const UNFOLLOW_ASSET_SQL = """
    WITH removed AS (
        DELETE FROM lista_seguimiento WHERE usuario_id = \$1::uuid AND activo_id = \$2::bigint
        RETURNING 1
    )
    SELECT EXISTS (SELECT 1 FROM removed)
    """
unfollow_asset(repo::PostgresWatchlist, user_id, asset_id) = watchlist_value(repo, UNFOLLOW_ASSET_SQL, user_id, asset_id)

struct InMemoryWatchlist <: WatchlistRepository
    prices::PriceRepository
    entries::Set{Tuple{String,Int}}
end
InMemoryWatchlist(prices::PriceRepository) = InMemoryWatchlist(prices, Set{Tuple{String,Int}}())

is_followed(repo::InMemoryWatchlist, user_id, asset_id) = (user_id, asset_id) in repo.entries
function follow_asset(repo::InMemoryWatchlist, user_id, asset_id)
    any(a -> a.id == asset_id, list_assets(repo.prices)) || return false
    push!(repo.entries, (user_id, asset_id))
    return true
end
function unfollow_asset(repo::InMemoryWatchlist, user_id, asset_id)
    is_followed(repo, user_id, asset_id) || return false
    delete!(repo.entries, (user_id, asset_id))
    return true
end
function watched_assets(repo::InMemoryWatchlist, user_id)
    map(filter(a -> is_followed(repo, user_id, a.id), list_assets(repo.prices))) do a
        history = price_history(repo.prices, a.id)
        date, price = isempty(history) ? (nothing, nothing) : last(history)
        daily = length(history) < 2 ? nothing : history[end - 1][2]
        dates = first.(history)
        function reference(cutoff)
            index = searchsortedlast(dates, cutoff)
            return index == 0 ? nothing : history[index][2]
        end
        weekly = date === nothing ? nothing : reference(date - Day(7))
        monthly = date === nothing ? nothing : reference(date - Month(1))
        (; a.id, a.symbol, a.name, a.market, a.currency, latest_price=price,
           latest_date=date === nothing ? nothing : string(date),
           changes=watchlist_changes(price, daily, weekly, monthly))
    end
end

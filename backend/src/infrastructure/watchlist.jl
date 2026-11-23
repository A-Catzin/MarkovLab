"""Persistencia del seguimiento: todas las operaciones reciben el id del usuario autenticado."""
abstract type WatchlistRepository end

struct PostgresWatchlist <: WatchlistRepository
    db::PostgresConnection
end

# La lista trae solo un cierre por activo; no carga todas las series para pintar la tabla.
const WATCHLIST_SQL = """
    SELECT a.id, a.simbolo AS symbol, a.nombre AS name, a.mercado AS market, a.moneda AS currency,
           p.price AS latest_price, p.date AS latest_date
    FROM lista_seguimiento l JOIN activos a ON a.id = l.activo_id
    LEFT JOIN LATERAL (
        SELECT coalesce(cierre_ajustado, cierre) AS price, fecha_operacion::text AS date
        FROM precios_historicos
        WHERE activo_id = a.id
        ORDER BY fecha_operacion DESC, (origen = 'api') DESC
        LIMIT 1
    ) p ON true
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

function watched_assets(repo::PostgresWatchlist, user_id)
    rows = with_connection(conn -> rows_from(run_query(conn, WATCHLIST_SQL, [user_id])), repo.db)
    return [(; id=Int(r.id), r.symbol, r.name, r.market, currency=strip(r.currency),
              latest_price=orelse(r.latest_price), latest_date=orelse(r.latest_date)) for r in rows]
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
        (; a.id, a.symbol, a.name, a.market, a.currency, latest_price=price,
           latest_date=date === nothing ? nothing : string(date))
    end
end

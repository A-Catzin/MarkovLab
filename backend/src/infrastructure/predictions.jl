abstract type PredictionRepository end

struct InMemoryPredictionRepository <: PredictionRepository
    saved::Dict{Tuple{String,String},NamedTuple}
    lock::ReentrantLock
end
InMemoryPredictionRepository() = InMemoryPredictionRepository(Dict{Tuple{String,String},NamedTuple}(), ReentrantLock())

struct PostgresPredictionRepository <: PredictionRepository
    db::PostgresConnection
end
PostgresPredictionRepository(url::AbstractString) = PostgresPredictionRepository(PostgresConnection(url))

function prediction_asset(prices::InMemoryPriceRepository, id)
    lock(prices.lock) do
        for ((market, symbol), item) in prices.assets
            item.id == id && return (; symbol, market)
        end
        return nothing
    end
end

function prediction_asset(prices::PostgresPriceRepository, id)
    rows = with_connection(c -> rows_from(run_query(c,
        "SELECT simbolo AS symbol, mercado AS market FROM activos WHERE id=\$1::bigint", [id])), prices.db)
    return isempty(rows) ? nothing : only(rows)
end

function save_prediction(repo::InMemoryPredictionRepository, actor, asset, payload)
    lock(repo.lock) do
        row = (id=random_uuid(), asset_id=asset, calculated_at=portfolio_now(), payload=deepcopy(payload))
        repo.saved[(actor, row.id)] = row
        return row
    end
end

function read_prediction(repo::InMemoryPredictionRepository, actor, id)
    is_uuid(id) || return nothing
    return lock(() -> deepcopy(Base.get(repo.saved, (actor, lowercase(id)), nothing)), repo.lock)
end

const PREDICTION_COLUMNS = """
    id::text AS id, activo_id AS asset_id, datos::text AS payload,
    to_char(creado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS calculated_at
    """
prediction_row(x) = (; x.id, asset_id=Int(x.asset_id), x.calculated_at, payload=plain(JSON.parse(x.payload)))

function save_prediction(repo::PostgresPredictionRepository, actor, asset, payload)
    # A lost connection after the INSERT is not safe to retry.
    lock(repo.db.lock) do
        rows = rows_from(run_query(connection!(repo.db), """
            INSERT INTO predicciones_activos (usuario_id, activo_id, datos)
            VALUES (\$1::uuid, \$2::bigint, \$3::jsonb) RETURNING $PREDICTION_COLUMNS
            """, [actor, string(asset), JSON.json(payload)]))
        return prediction_row(only(rows))
    end
end

function read_prediction(repo::PostgresPredictionRepository, actor, id)
    is_uuid(id) || return nothing
    rows = with_connection(c -> rows_from(run_query(c, """
        SELECT $PREDICTION_COLUMNS FROM predicciones_activos
        WHERE id=\$1::uuid AND usuario_id=\$2::uuid
        """, [id, actor])), repo.db)
    return isempty(rows) ? nothing : prediction_row(only(rows))
end

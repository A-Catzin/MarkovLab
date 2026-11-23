function optimization_basis(repo::InMemoryPortfolioRepository, actor, id)
    lock(repo.lock) do
        portfolio = get_portfolio(repo, actor, id)
        portfolio === nothing && return nothing
        version = length(Base.get(repo.versions, portfolio.id, ())) + 1
        return (; portfolio, version)
    end
end

function optimization_basis(repo::PostgresPortfolioRepository, actor, id)
    is_uuid(id) || return nothing
    portfolio_consistent_read(repo) do conn
        portfolio = portfolio_from_connection(conn, actor, id)
        portfolio === nothing && return nothing
        version = single_value(run_query(conn,
            "SELECT coalesce(max(numero),0)+1 FROM versiones_cartera WHERE cartera_id=\$1::uuid", [portfolio.id]))
        return (; portfolio, version=Int(version))
    end
end

function store_optimization(repo::InMemoryPortfolioRepository, actor, id, result)
    lock(repo.lock) do
        portfolio = get_portfolio(repo, actor, id)
        portfolio === nothing && return nothing
        persist = (id=random_uuid(), created_at=portfolio_now(), result=deepcopy(result))
        push!(get!(repo.optimizations, portfolio.id, NamedTuple[]), persist)
        return persist
    end
end

function get_optimizations(repo::InMemoryPortfolioRepository, actor, id)
    lock(repo.lock) do
        portfolio = get_portfolio(repo, actor, id)
        portfolio === nothing && return nothing
        saved = Base.get(repo.optimizations, portfolio.id, NamedTuple[])
        return deepcopy(reverse(last(saved, min(length(saved), OPTIMIZATION_HISTORY_LIMIT))))
    end
end

const OPTIMIZATION_HISTORY_LIMIT = 20
const OPTIMIZATION_COLUMNS = """
    id::text AS id, resultado::text AS result,
    to_char(creado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
    """

optimization_row(row) = (id=row.id, created_at=row.created_at, result=plain(JSON.parse(row.result)))

function store_optimization(repo::PostgresPortfolioRepository, actor, id, result)
    is_uuid(id) || return nothing
    portfolio_write_once(repo) do conn
        rows = rows_from(run_query(conn, """
            INSERT INTO optimizaciones_cartera (cartera_id, resultado)
            SELECT id, \$3::jsonb FROM carteras WHERE id=\$1::uuid AND usuario_id=\$2::uuid
            FOR KEY SHARE
            RETURNING $OPTIMIZATION_COLUMNS
            """, [id, actor, JSON.json(result)]))
        return isempty(rows) ? nothing : optimization_row(only(rows))
    end
end

function get_optimizations(repo::PostgresPortfolioRepository, actor, id)
    is_uuid(id) || return nothing
    portfolio_consistent_read(repo) do conn
        owned = rows_from(run_query(conn, "SELECT 1 FROM carteras WHERE id=\$1::uuid AND usuario_id=\$2::uuid",
                                    [id, actor]))
        isempty(owned) && return nothing
        rows = rows_from(run_query(conn, """
            SELECT $OPTIMIZATION_COLUMNS FROM optimizaciones_cartera
            WHERE cartera_id=\$1::uuid ORDER BY creado_en DESC, id DESC LIMIT \$2
            """, [id, OPTIMIZATION_HISTORY_LIMIT]))
        return optimization_row.(rows)
    end
end

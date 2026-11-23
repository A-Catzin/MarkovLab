const BACKTEST_HISTORY_LIMIT = 20
const BACKTEST_COLUMNS = """
    id::text AS id, resultado::text AS result,
    to_char(creado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS executed_at
    """

function backtest_record(id, executed_at, result)
    return merge(Dict{String,Any}(string(k)=>v for (k,v) in pairs(result)),
                 Dict("id"=>id, "executed_at"=>executed_at))
end

backtest_row(row) = backtest_record(row.id, row.executed_at, plain(JSON.parse(row.result)))

function save_backtest(repo::InMemoryPortfolioRepository, actor, id, result)
    lock(repo.lock) do
        portfolio = get_portfolio(repo, actor, id)
        portfolio === nothing && return nothing
        row = backtest_record(random_uuid(), portfolio_now(), deepcopy(result))
        push!(get!(repo.backtests, portfolio.id, Dict{String,Any}[]), row)
        return row
    end
end

function list_backtests(repo::InMemoryPortfolioRepository, actor, id)
    lock(repo.lock) do
        portfolio = get_portfolio(repo, actor, id)
        portfolio === nothing && return nothing
        rows = Base.get(repo.backtests, portfolio.id, Dict{String,Any}[])
        return deepcopy(reverse(last(rows, min(length(rows), BACKTEST_HISTORY_LIMIT))))
    end
end

function save_backtest(repo::PostgresPortfolioRepository, actor, id, result)
    is_uuid(id) || return nothing
    portfolio_write_once(repo) do conn
        rows = rows_from(run_query(conn, """
            INSERT INTO backtests_cartera (cartera_id, resultado)
            SELECT id, \$3::jsonb FROM carteras WHERE id=\$1::uuid AND usuario_id=\$2::uuid
            FOR KEY SHARE
            RETURNING $BACKTEST_COLUMNS
            """, [id, actor, JSON.json(result)]))
        return isempty(rows) ? nothing : backtest_row(only(rows))
    end
end

function list_backtests(repo::PostgresPortfolioRepository, actor, id)
    is_uuid(id) || return nothing
    portfolio_consistent_read(repo) do conn
        owned = rows_from(run_query(conn,
            "SELECT 1 FROM carteras WHERE id=\$1::uuid AND usuario_id=\$2::uuid", [id, actor]))
        isempty(owned) && return nothing
        rows = rows_from(run_query(conn, """
            SELECT $BACKTEST_COLUMNS FROM backtests_cartera
            WHERE cartera_id=\$1::uuid ORDER BY creado_en DESC, id DESC LIMIT \$2
            """, [id, BACKTEST_HISTORY_LIMIT]))
        return backtest_row.(rows)
    end
end

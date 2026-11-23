# Representación histórica: copia el contenido, no referencia los pesos vivos.
portfolio_now() = Dates.format(now(Dates.UTC), dateformat"yyyy-mm-ddTHH:MM:SS") * "Z"

function portfolio_copy_name(portfolio, name)
    suffix = " (copia)"
    chosen = name === nothing ? first(portfolio.name, MAX_PORTFOLIO_NAME_LENGTH - length(suffix)) * suffix : name
    positions = [PositionDraft(p.asset_id, p.weight) for p in portfolio.positions]
    return PortfolioDraft(chosen, portfolio.capital, portfolio.currency, positions; start_date=Date(portfolio.start_date))
end

function version_payload(p::SavedPortfolio, number, created_at, current, lineage)
    return Dict{String,Any}("id" => "$(p.id):$number", "version_number" => number, "is_current" => current,
        "name" => p.name, "capital" => p.capital, "currency" => p.currency, "start_date" => p.start_date,
        "created_at" => created_at, "derived_from_id" => lineage.id, "derived_from_name" => lineage.name,
        "estimated_annual_return" => nothing, "estimated_annual_volatility" => nothing,
        "positions" => [Dict("asset_id" => x.asset_id, "symbol" => x.symbol,
                              "name" => x.name, "weight" => x.weight) for x in p.positions])
end

function memory_lineage(repo, actor, id)
    source = Base.get(repo.parents, id, nothing)
    parent = source === nothing ? nothing : get_portfolio(repo, actor, source)
    return parent === nothing ? (; id=nothing, name=nothing) : (; id=parent.id, name=parent.name)
end

function update_portfolio(repo::InMemoryPortfolioRepository, actor, id, draft::PortfolioDraft)
    lock(repo.lock) do
        previous = get_portfolio(repo, actor, id)
        previous === nothing && return nothing
        positions = memory_portfolio_positions(repo, draft)
        versions = get!(repo.versions, previous.id, Dict{String,Any}[])
        push!(versions, version_payload(previous, length(versions) + 1,
              repo.version_dates[previous.id], false, memory_lineage(repo, actor, previous.id)))
        updated = SavedPortfolio(previous.id, draft.name, draft.capital, draft.currency,
            draft.start_date === nothing ? previous.start_date : string(draft.start_date),
            previous.status, previous.created_at, positions)
        repo.saved[findfirst(p -> p.id == previous.id, repo.saved)] = updated
        repo.version_dates[previous.id] = portfolio_now()
        return updated
    end
end

function duplicate_portfolio(repo::InMemoryPortfolioRepository, actor, id, name)
    lock(repo.lock) do
        original = get_portfolio(repo, actor, id)
        original === nothing && return nothing
        copy = create_portfolio(repo, actor, portfolio_copy_name(original, name))
        repo.parents[copy.id] = original.id
        return (; portfolio=copy, source_id=original.id)
    end
end

function list_portfolio_versions(repo::InMemoryPortfolioRepository, actor, id)
    lock(repo.lock) do
        current = get_portfolio(repo, actor, id)
        current === nothing && return nothing
        history = Base.get(repo.versions, current.id, Dict{String,Any}[])
        recent = version_payload(current, length(history) + 1,
            repo.version_dates[current.id], true, memory_lineage(repo, actor, current.id))
        return [recent; reverse(history)]
    end
end

# No se reintenta una escritura no idempotente si se pierde su confirmación.
function portfolio_write_once(f, repo::PostgresPortfolioRepository)
    lock(repo.db.lock) do
        conn = connection!(repo.db)
        in_transaction(() -> f(conn), conn)
    end
end

function portfolio_from_connection(conn, actor, id; lock_row=false)
    sql = lock_row ? GET_PORTFOLIO_SQL * " FOR UPDATE" : GET_PORTFOLIO_SQL
    saved = portfolios_with_positions(conn, actor, rows_from(run_query(conn, sql, [id, actor])))
    return isempty(saved) ? nothing : only(saved)
end

function portfolio_version_metadata(conn, actor, id)
    return only(rows_from(run_query(conn, """
        SELECT p.id::text AS parent_id, p.nombre AS parent_name,
            to_char(c.actualizado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS current_at
        FROM carteras c LEFT JOIN carteras p ON p.id = c.derivada_de_id AND p.usuario_id = c.usuario_id
        WHERE c.id = \$1::uuid AND c.usuario_id = \$2::uuid
        """, [id, actor])))
end

version_lineage(metadata) = (; id=orelse(metadata.parent_id), name=orelse(metadata.parent_name))

function update_portfolio(repo::PostgresPortfolioRepository, actor, id, draft::PortfolioDraft)
    is_uuid(id) || return nothing
    return portfolio_write_once(repo) do conn
        previous = portfolio_from_connection(conn, actor, id; lock_row=true)
        previous === nothing && return nothing
        assets, weights = position_parameters(conn, draft)
        number = single_value(run_query(conn, "SELECT coalesce(max(numero),0)+1 FROM versiones_cartera WHERE cartera_id=\$1::uuid", [id]))
        meta = portfolio_version_metadata(conn, actor, id)
        prior = version_payload(previous, number, meta.current_at, false, version_lineage(meta))
        close(run_query(conn, "INSERT INTO versiones_cartera (cartera_id,numero,datos) VALUES (\$1::uuid,\$2::int,\$3::jsonb)",
            [id, string(number), JSON.json(prior)]))
        close(run_query(conn, """
            UPDATE carteras SET nombre=\$3, capital_inicial=\$4::numeric, moneda=\$5,
                fecha_inicio=coalesce(\$6::date,fecha_inicio)
            WHERE id=\$1::uuid AND usuario_id=\$2::uuid
            """, [id, actor, draft.name, string(round(draft.capital; digits=2)), draft.currency,
                  portfolio_date_parameter(draft.start_date)]))
        close(run_query(conn, "DELETE FROM posiciones_cartera WHERE cartera_id=\$1::uuid", [id]))
        close(run_query(conn, INSERT_POSITIONS_SQL, [id, assets, weights]))
        return portfolio_from_connection(conn, actor, id)
    end
end

function duplicate_portfolio(repo::PostgresPortfolioRepository, actor, id, name)
    is_uuid(id) || return nothing
    return portfolio_write_once(repo) do conn
        original = portfolio_from_connection(conn, actor, id; lock_row=true)
        original === nothing && return nothing
        draft = portfolio_copy_name(original, name)
        copied_id = single_value(run_query(conn, """
            INSERT INTO carteras (usuario_id,nombre,capital_inicial,moneda,fecha_inicio,derivada_de_id)
            SELECT usuario_id, \$3, capital_inicial, moneda, fecha_inicio, id
            FROM carteras WHERE id=\$1::uuid AND usuario_id=\$2::uuid
            RETURNING id::text
            """, [id, actor, draft.name]))
        close(run_query(conn, """
            INSERT INTO posiciones_cartera (cartera_id,activo_id,peso,cantidad_estimada)
            SELECT \$2::uuid, activo_id, peso, cantidad_estimada
            FROM posiciones_cartera WHERE cartera_id=\$1::uuid
            """, [id, copied_id]))
        return (; portfolio=portfolio_from_connection(conn, actor, copied_id), source_id=original.id)
    end
end

function list_portfolio_versions(repo::PostgresPortfolioRepository, actor, id)
    is_uuid(id) || return nothing
    return portfolio_consistent_read(repo) do conn
        current = portfolio_from_connection(conn, actor, id)
        current === nothing && return nothing
        meta = portfolio_version_metadata(conn, actor, id)
        rows = rows_from(run_query(conn, """
            SELECT numero, datos::text AS snapshot
            FROM versiones_cartera WHERE cartera_id=\$1::uuid ORDER BY numero DESC
            """, [id]))
        history = [Dict{String,Any}(JSON.parse(row.snapshot)) for row in rows]
        number = isempty(rows) ? 1 : first(rows).numero + 1
        latest = version_payload(current, number, meta.current_at, true, version_lineage(meta))
        return [latest; history]
    end
end

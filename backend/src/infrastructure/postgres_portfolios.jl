"""
    PostgresPortfolioRepository(url)

Adaptador de carteras sobre PostgreSQL (tablas `carteras` y `posiciones_cartera`). Toda
consulta filtra por `usuario_id`: un usuario nunca lee ni borra carteras de otro.
"""
struct PostgresPortfolioRepository <: PortfolioRepository
    db::PostgresConnection
end

PostgresPortfolioRepository(url::AbstractString) = PostgresPortfolioRepository(PostgresConnection(url))

connection!(portfolios::PostgresPortfolioRepository) = connection!(portfolios.db)
Base.close(portfolios::PostgresPortfolioRepository) = close(portfolios.db)

# Estado de la cartera en la base → símbolo del dominio.
const PORTFOLIO_STATUS_FROM_DB = Dict("borrador" => :draft, "activa" => :active, "archivada" => :archived)

const EXISTING_ASSETS_SQL = "SELECT id FROM activos WHERE id = ANY(\$1::bigint[])"

const INSERT_PORTFOLIO_SQL = """
    INSERT INTO carteras (id, usuario_id, nombre, capital_inicial, moneda, fecha_inicio, estado, creado_en, actualizado_en)
    VALUES (gen_random_uuid(), \$1::uuid, \$2, \$3::numeric, \$4, current_date, 'borrador', now(), now())
    RETURNING id::text AS id
    """

# Todas las posiciones en una sola consulta, con arreglos que `unnest` vuelve filas.
const INSERT_POSITIONS_SQL = """
    INSERT INTO posiciones_cartera (cartera_id, activo_id, peso)
    SELECT \$1::uuid, t.activo_id, t.peso
    FROM unnest(\$2::bigint[], \$3::numeric[]) AS t(activo_id, peso)
    """

# Las cifras se leen como float8 y las fechas como texto ISO, para no depender de
# conversiones de tipos del cliente.
const PORTFOLIO_COLUMNS = """
    c.id::text AS id, c.nombre, c.capital_inicial::float8 AS capital, c.moneda, c.fecha_inicio::text AS fecha_inicio,
    c.estado::text AS estado, to_char(c.creado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS creado_en
    """

const LIST_PORTFOLIOS_SQL = """
    SELECT $PORTFOLIO_COLUMNS FROM carteras c
    WHERE c.usuario_id = \$1::uuid
    ORDER BY c.creado_en DESC, c.id
    """

const GET_PORTFOLIO_SQL = "SELECT $PORTFOLIO_COLUMNS FROM carteras c WHERE c.id = \$1::uuid AND c.usuario_id = \$2::uuid"

# Posiciones de varias carteras a la vez (las del usuario), con los datos del activo.
const POSITIONS_SQL = """
    SELECT p.cartera_id::text AS cartera_id, p.activo_id, a.simbolo, a.mercado, a.nombre, p.peso::float8 AS peso
    FROM posiciones_cartera p
    JOIN carteras c ON c.id = p.cartera_id
    JOIN activos a ON a.id = p.activo_id
    WHERE c.usuario_id = \$1::uuid AND p.cartera_id = ANY(\$2::uuid[])
    ORDER BY p.peso DESC, a.simbolo
    """

const DELETE_PORTFOLIO_SQL = "DELETE FROM carteras WHERE id = \$1::uuid AND usuario_id = \$2::uuid RETURNING id"

# Lee las posiciones de las carteras `rows` y arma los `SavedPortfolio`.
function portfolios_with_positions(conn, user_id, rows)
    isempty(rows) && return SavedPortfolio[]
    ids = pg_array(row.id for row in rows)
    positions = rows_from(LibPQ.execute(conn, POSITIONS_SQL, [user_id, ids]; throw_error=true))
    by_portfolio = Dict{String,Vector{SavedPosition}}()
    for p in positions
        push!(get!(by_portfolio, p.cartera_id, SavedPosition[]),
              SavedPosition(Int(p.activo_id), p.simbolo, p.mercado, p.nombre, p.peso))
    end
    return [SavedPortfolio(r.id, r.nombre, r.capital, strip(r.moneda), r.fecha_inicio,
                           PORTFOLIO_STATUS_FROM_DB[r.estado], orelse(r.creado_en),
                           Base.get(by_portfolio, r.id, SavedPosition[])) for r in rows]
end

function create_portfolio(portfolios::PostgresPortfolioRepository, user_id, draft::PortfolioDraft)
    ids = [p.asset_id for p in draft.positions]
    # Los pesos se guardan con 8 decimales (numeric(9, 8)).
    weights = [string(round(p.weight; digits=8)) for p in draft.positions]
    id = with_connection(portfolios.db) do conn
        in_transaction(conn) do
            existing = rows_from(LibPQ.execute(conn, EXISTING_ASSETS_SQL, [pg_array(ids)]; throw_error=true))
            unknown = setdiff(ids, [Int(row.id) for row in existing])
            isempty(unknown) || throw(ArgumentError("unknown asset ids: $(join(sort(unknown), ", "))"))
            created = only(rows_from(LibPQ.execute(conn, INSERT_PORTFOLIO_SQL,
                [user_id, draft.name, string(round(draft.capital; digits=2)), draft.currency]; throw_error=true)))
            close(LibPQ.execute(conn, INSERT_POSITIONS_SQL, [created.id, pg_array(ids), pg_array(weights)]; throw_error=true))
            created.id
        end
    end
    return get_portfolio(portfolios, user_id, id)
end

function list_portfolios(portfolios::PostgresPortfolioRepository, user_id)
    with_connection(portfolios.db) do conn
        rows = rows_from(LibPQ.execute(conn, LIST_PORTFOLIOS_SQL, [user_id]; throw_error=true))
        portfolios_with_positions(conn, user_id, rows)
    end
end

function get_portfolio(portfolios::PostgresPortfolioRepository, user_id, id)
    is_uuid(id) || return nothing
    with_connection(portfolios.db) do conn
        rows = rows_from(LibPQ.execute(conn, GET_PORTFOLIO_SQL, [id, user_id]; throw_error=true))
        found = portfolios_with_positions(conn, user_id, rows)
        isempty(found) ? nothing : only(found)
    end
end

function delete_portfolio(portfolios::PostgresPortfolioRepository, user_id, id)
    is_uuid(id) || return false
    deleted = with_connection(conn -> rows_from(LibPQ.execute(conn, DELETE_PORTFOLIO_SQL, [id, user_id]; throw_error=true)),
                              portfolios.db)
    return !isempty(deleted)
end

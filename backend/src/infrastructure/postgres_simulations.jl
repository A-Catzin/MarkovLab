"""
    PostgresSimulationRepository(url)

Simulaciones guardadas en la tabla `simulaciones`. Los días con que se estimó (`window`)
viajan dentro de `resumen`, como `estimation_window`, porque la tabla no tiene columnas
para ellos.
"""
struct PostgresSimulationRepository <: SimulationRepository
    db::PostgresConnection
end

PostgresSimulationRepository(url::AbstractString) = PostgresSimulationRepository(PostgresConnection(url))

connection!(simulations::PostgresSimulationRepository) = connection!(simulations.db)
Base.close(simulations::PostgresSimulationRepository) = close(simulations.db)

const SIMULATION_COLUMNS = """
    id::text AS id, cartera_id::text AS cartera_id, modelo, num_simulaciones, horizonte, confianza, semilla,
    observaciones, activos::text AS activos, retorno_esperado_periodo, volatilidad_esperada_periodo,
    valor_en_riesgo, valor_en_riesgo_condicional, resumen::text AS resumen,
    to_char(creado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS creado_en
    """

const INSERT_SIMULATION_SQL = """
    INSERT INTO simulaciones
        (usuario_id, cartera_id, modelo, num_simulaciones, horizonte, confianza, semilla, observaciones, activos,
         retorno_esperado_periodo, volatilidad_esperada_periodo, valor_en_riesgo, valor_en_riesgo_condicional, resumen)
    VALUES (\$1::uuid, \$2::uuid, \$3, \$4, \$5, \$6, \$7, \$8, \$9::jsonb, \$10, \$11, \$12, \$13, \$14::jsonb)
    RETURNING $SIMULATION_COLUMNS
    """

# Solo las del usuario y esa cartera: una cartera ajena no devuelve nada.
const LIST_SIMULATIONS_SQL = """
    SELECT $SIMULATION_COLUMNS
    FROM simulaciones
    WHERE usuario_id = \$1::uuid AND cartera_id = \$2::uuid
    ORDER BY creado_en DESC, id DESC
    LIMIT \$3
    """

# JSON leído de la base → diccionarios y vectores de Julia, para comparar con lo guardado.
plain(value::AbstractDict) = Dict{String,Any}(String(k) => plain(v) for (k, v) in value)
plain(value::AbstractVector) = Any[plain(v) for v in value]
plain(value) = value

function simulation_from_row(row)
    assets = JSON.parse(row.activos)
    summary = plain(JSON.parse(row.resumen))
    window = pop!(summary, "estimation_window")
    return SavedSimulation(row.id, orelse(row.cartera_id), row.modelo, Int(row.num_simulaciones), Int(row.horizonte),
                           Float64(row.confianza), Int(row.semilla), Int(row.observaciones),
                           String.(assets["symbols"]), Float64.(assets["weights"]),
                           (Date(window["from"]), Date(window["to"])), Float64(row.retorno_esperado_periodo),
                           Float64(row.volatilidad_esperada_periodo), Float64(row.valor_en_riesgo),
                           Float64(row.valor_en_riesgo_condicional), summary, orelse(row.creado_en))
end

function save_simulation(simulations::PostgresSimulationRepository, user_id::AbstractString, s::SavedSimulation)
    summary = merge(s.summary, Dict("estimation_window" => Dict("from" => string(s.window[1]), "to" => string(s.window[2]))))
    params = [user_id, something(s.portfolio_id, missing), s.model, s.simulations, s.horizon, s.confidence, s.seed,
              s.observations, JSON.json(Dict("symbols" => s.symbols, "weights" => s.weights)), s.expected_return,
              s.expected_volatility, s.value_at_risk, s.conditional_value_at_risk, JSON.json(summary)]
    rows = with_connection(conn -> rows_from(LibPQ.execute(conn, INSERT_SIMULATION_SQL, params; throw_error=true)),
                           simulations.db)
    return simulation_from_row(only(rows))
end

function list_simulations(simulations::PostgresSimulationRepository, user_id::AbstractString,
                          portfolio_id::AbstractString; limit::Integer=20)
    (is_uuid(user_id) && is_uuid(portfolio_id)) || return SavedSimulation[]
    rows = with_connection(simulations.db) do conn
        rows_from(LibPQ.execute(conn, LIST_SIMULATIONS_SQL, [user_id, portfolio_id, Int(limit)]; throw_error=true))
    end
    return [simulation_from_row(row) for row in rows]
end

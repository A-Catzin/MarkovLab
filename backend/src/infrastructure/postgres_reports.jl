abstract type ReportsRepository end

struct PostgresReportsRepository <: ReportsRepository
    db::PostgresConnection
end
PostgresReportsRepository(url::AbstractString) = PostgresReportsRepository(PostgresConnection(url))

# The actor is bound in each arm. The outer limit applies across all modules,
# not separately per portfolio or module.
const REPORT_ROWS_SQL = """
WITH visible AS (
    SELECT 'simulation' AS kind, s.id, s.creado_en,
        jsonb_build_object('model',s.modelo,'window',s.resumen->'estimation_window','symbols',s.activos->'symbols',
            'horizon',s.horizonte,'simulations',s.num_simulaciones,'confidence',s.confianza,'seed',s.semilla,
            'observations',s.observaciones,'value_at_risk',s.valor_en_riesgo,
            'conditional_value_at_risk',s.valor_en_riesgo_condicional,'expected_period_return',s.retorno_esperado_periodo,
            'expected_period_volatility',s.volatilidad_esperada_periodo) AS payload
    FROM simulaciones s WHERE s.usuario_id=\$1::uuid AND (s.cartera_id IS NULL OR EXISTS (
        SELECT 1 FROM carteras p WHERE p.id=s.cartera_id AND p.usuario_id=\$1::uuid))
    UNION ALL
    SELECT 'optimization', o.id, o.creado_en, o.resultado - ARRAY['weights','inputs']
    FROM optimizaciones_cartera o JOIN carteras p ON p.id=o.cartera_id WHERE p.usuario_id=\$1::uuid
    UNION ALL
    SELECT 'prediction', id, creado_en, datos - ARRAY['history','anchor_closes']
    FROM predicciones_activos WHERE usuario_id=\$1::uuid
    UNION ALL
    SELECT 'backtest', b.id, b.creado_en, b.resultado - ARRAY['curve','weights']
    FROM backtests_cartera b JOIN carteras p ON p.id=b.cartera_id WHERE p.usuario_id=\$1::uuid
)
SELECT kind, id::text AS id, payload::text AS payload,
       to_char(creado_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS calculated_at
FROM visible
WHERE (\$2::text IS NULL OR kind=\$2) AND (\$3::uuid IS NULL OR id=\$3)
ORDER BY creado_en DESC, kind, id DESC LIMIT \$4::integer
"""

function report_rows(repo::PostgresReportsRepository, actor; kind=missing, id=missing, limit::Int)
    rows = with_connection(c -> rows_from(run_query(c, REPORT_ROWS_SQL, [actor, kind, id, limit])), repo.db)
    return [(; row.kind, row.id, row.calculated_at, payload=plain(JSON.parse(row.payload))) for row in rows]
end

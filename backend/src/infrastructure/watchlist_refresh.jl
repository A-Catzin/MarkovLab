# Solo el actor autenticado determina los activos. Se omiten símbolos ambiguos
# porque la fuente de mercado y la sincronización identifican por símbolo.
const QUEUE_MARKET_REFRESH_SQL = """
    WITH elegibles AS (
        SELECT a.id, a.simbolo
        FROM lista_seguimiento l JOIN activos a ON a.id = l.activo_id
        WHERE l.usuario_id = \$1::uuid AND NOT EXISTS (
            SELECT 1 FROM activos b WHERE b.simbolo = a.simbolo AND b.id <> a.id
        )
    ), aceptadas AS (
        INSERT INTO actualizaciones_mercado (simbolo, activo_id)
        SELECT simbolo, id FROM elegibles ORDER BY simbolo
        ON CONFLICT (simbolo) DO UPDATE
            SET activo_id = EXCLUDED.activo_id, solicitado_en = now(),
                iniciado_en = NULL, estado = 'pendiente'
        WHERE actualizaciones_mercado.estado IN ('completada', 'fallida')
          AND (actualizaciones_mercado.solicitado_en AT TIME ZONE 'UTC')::date < (now() AT TIME ZONE 'UTC')::date
          AND (actualizaciones_mercado.iniciado_en AT TIME ZONE 'UTC')::date < (now() AT TIME ZONE 'UTC')::date
    )
    SELECT EXISTS (SELECT 1 FROM elegibles)
    """

queue_market_refresh!(repo::PostgresWatchlist, actor_id) = with_connection(repo.db) do conn
    single_value(run_query(conn, QUEUE_MARKET_REFRESH_SQL, [actor_id]))
end

const CLAIM_MARKET_REFRESH_SQL = """
    WITH siguiente AS (
        SELECT simbolo FROM actualizaciones_mercado
        WHERE estado = 'pendiente'
        ORDER BY solicitado_en, simbolo
        LIMIT \$1::int
        FOR UPDATE SKIP LOCKED
    )
    UPDATE actualizaciones_mercado q
        SET estado = 'en_curso', iniciado_en = now()
    FROM siguiente s, activos a
    WHERE q.simbolo = s.simbolo AND a.id = q.activo_id
    RETURNING q.simbolo AS symbol, a.mercado AS market
    """

function claim_market_refresh!(repo::PostgresWatchlist, limit::Int)
    # Una respuesta de red perdida no debe reclamar un segundo lote. No se
    # reintenta una reclamación con resultado incierto.
    lock(repo.db.lock) do
        rows_from(run_query(connection!(repo.db), CLAIM_MARKET_REFRESH_SQL, [string(limit)]))
    end
end

function finish_market_refresh!(repo::PostgresWatchlist, symbol, success)
    with_connection(repo.db) do conn
        close(run_query(conn, """
            UPDATE actualizaciones_mercado SET estado = \$2
            WHERE simbolo = \$1 AND estado = 'en_curso'
            """, [symbol, success ? "completada" : "fallida"]))
    end
end

-- =============================================================================
-- MarkovLab · Migración 0002: cierre ajustado
--
-- Agrega a precios_historicos el cierre ajustado por dividendos y splits (la columna
-- "Adj Close" de los CSV, ver documentacion/datos/diccionario-datos.md). Es opcional:
-- las filas existentes y los archivos sin esa columna quedan en NULL.
--
-- Es una columna nueva, nula y sin valor por defecto: PostgreSQL no reescribe la tabla
-- ni modifica las filas que ya existen.
-- =============================================================================

BEGIN;

ALTER TABLE precios_historicos
    ADD COLUMN cierre_ajustado double precision;

-- Si viene, finito y positivo. No se compara con máximo y mínimo del día: descuenta
-- dividendos y splits posteriores, así que puede quedar fuera de ese rango.
ALTER TABLE precios_historicos
    ADD CONSTRAINT precios_historicos_cierre_ajustado_valido
    CHECK (cierre_ajustado IS NULL OR (cierre_ajustado > 0 AND cierre_ajustado < 'Infinity'));

COMMENT ON COLUMN precios_historicos.cierre_ajustado IS
    'Cierre ajustado por dividendos y splits (Adj Close); NULL si la fuente no lo trae.';

COMMIT;

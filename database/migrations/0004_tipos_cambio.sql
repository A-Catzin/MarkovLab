-- =============================================================================
-- MarkovLab · Migración 0004: tipos de cambio diarios
--
-- Para valuar cada cartera en su moneda: los precios de un activo en otra moneda se
-- convierten con el tipo de cambio del mismo día. El dólar es la moneda puente: cada fila
-- dice cuántas unidades de `moneda` vale 1 USD ese día (MXN ≈ 18.6, EUR ≈ 0.90). Con eso
-- salen todas las combinaciones (MXN → EUR = valor_EUR / valor_MXN).
--
-- Se cargan desde Yahoo Finance (`MXN=X`, `EUR=X`) con `sync_prices.jl --divisas`.
-- Solo agrega una tabla; no toca datos existentes.
-- =============================================================================

BEGIN;

CREATE TABLE tipos_cambio (
    moneda       char(3)          NOT NULL,
    fecha        date             NOT NULL,
    origen       origen_precio    NOT NULL,
    -- Unidades de `moneda` por 1 USD al cierre del día.
    valor        double precision NOT NULL,
    importado_en timestamptz      NOT NULL DEFAULT now(),
    -- Un valor por moneda, fecha y origen, como en precios_historicos.
    PRIMARY KEY (moneda, fecha, origen),
    -- El dólar contra sí mismo vale 1 siempre y no se guarda.
    CONSTRAINT tipos_cambio_moneda_valida CHECK (moneda ~ '^[A-Z]{3}$' AND moneda <> 'USD'),
    -- 'NaN' e 'Infinity' son valores válidos de double precision, por eso se excluyen.
    CONSTRAINT tipos_cambio_valor_positivo CHECK (valor > 0 AND valor < 'Infinity')
);

COMMENT ON TABLE tipos_cambio IS
    'Tipo de cambio diario contra el dólar: unidades de `moneda` por 1 USD. Fuente: Yahoo Finance (MXN=X, EUR=X).';

-- Igual que el resto de las tablas: el acceso es solo desde el backend.
ALTER TABLE tipos_cambio ENABLE ROW LEVEL SECURITY;

COMMIT;

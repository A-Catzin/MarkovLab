BEGIN;

CREATE TABLE optimizaciones_cartera (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cartera_id uuid NOT NULL REFERENCES carteras(id) ON DELETE CASCADE,
    creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    resultado jsonb NOT NULL CHECK (jsonb_typeof(resultado) = 'object')
);

CREATE INDEX idx_optimizaciones_cartera_creado
    ON optimizaciones_cartera (cartera_id, creado_en DESC, id DESC);
ALTER TABLE optimizaciones_cartera ENABLE ROW LEVEL SECURITY;

COMMIT;

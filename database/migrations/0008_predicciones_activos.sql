BEGIN;

CREATE TABLE predicciones_activos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    activo_id bigint NOT NULL REFERENCES activos(id) ON DELETE CASCADE,
    creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    datos jsonb NOT NULL CHECK (jsonb_typeof(datos) = 'object')
);

CREATE INDEX idx_predicciones_activos_usuario ON predicciones_activos (usuario_id);
CREATE INDEX idx_predicciones_activos_activo ON predicciones_activos (activo_id);
ALTER TABLE predicciones_activos ENABLE ROW LEVEL SECURITY;

COMMIT;

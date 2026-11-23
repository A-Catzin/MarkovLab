BEGIN;

-- Una solicitud compartida por símbolo. No almacena identidad ni listas de usuarios.
CREATE TABLE actualizaciones_mercado (
    simbolo text PRIMARY KEY,
    activo_id bigint NOT NULL REFERENCES activos(id) ON DELETE CASCADE,
    solicitado_en timestamptz NOT NULL DEFAULT now(),
    iniciado_en timestamptz,
    estado text NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'en_curso', 'completada', 'fallida'))
);
CREATE INDEX actualizaciones_mercado_pendientes
    ON actualizaciones_mercado (solicitado_en, simbolo) WHERE estado = 'pendiente';
ALTER TABLE actualizaciones_mercado ENABLE ROW LEVEL SECURITY;

COMMIT;

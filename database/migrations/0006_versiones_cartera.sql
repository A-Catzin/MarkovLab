BEGIN;

-- Cada edición conserva la configuración que reemplazó, en la misma transacción.
CREATE TABLE versiones_cartera (
    cartera_id uuid NOT NULL REFERENCES carteras(id) ON DELETE CASCADE,
    numero integer NOT NULL CHECK (numero > 0),
    guardada_en timestamptz NOT NULL DEFAULT now(),
    datos jsonb NOT NULL CHECK (jsonb_typeof(datos) = 'object'),
    PRIMARY KEY (cartera_id, numero)
);
ALTER TABLE versiones_cartera ENABLE ROW LEVEL SECURITY;

COMMIT;

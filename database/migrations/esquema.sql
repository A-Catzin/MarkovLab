-- =============================================================================
-- MarkovLab · Esquema base (0001)
--
-- Esquema de la base en PostgreSQL 15+, administrada por Supabase. Refleja
-- exactamente lo que está aplicado en el proyecto: mismos nombres de tablas, columnas,
-- restricciones, índices y triggers, leídos de la base el 2026-11-04.
-- Los cambios posteriores van en migraciones numeradas de esta carpeta (0002, 0003…).
--
-- Tablas: usuarios, activos, precios_historicos, sincronizaciones,
-- lista_seguimiento, carteras, posiciones_cartera y simulaciones.
--
-- Acceso: solo la API Julia se conecta a la base (SRS 6.5). Todas las tablas tienen
-- RLS activado y sin políticas: los roles públicos de Supabase (anon, authenticated)
-- no ven nada, y el backend entra con el usuario dueño de las tablas.
--
-- Todo corre en una sola transacción: se aplica completo o no se aplica nada.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

-- Actualiza la columna actualizado_en en cada UPDATE.
CREATE FUNCTION establecer_actualizado_en() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------

-- Origen de un dato de precio (RF-13, RNF-10).
CREATE TYPE origen_precio AS ENUM ('csv', 'api', 'manual');

-- Estado de una cartera.
CREATE TYPE estado_cartera AS ENUM ('borrador', 'activa', 'archivada');

-- Estado de una sincronización con una fuente de datos (SRS 7.1).
CREATE TYPE estado_sincronizacion AS ENUM ('en_curso', 'exitosa', 'parcial', 'fallida');

-- -----------------------------------------------------------------------------
-- Usuarios
-- -----------------------------------------------------------------------------

-- Usuario de la aplicación. El inicio de sesión es con Google; google_sub es el
-- identificador estable que entrega Google ("sub" del token).
CREATE TABLE usuarios (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    correo         text        NOT NULL,
    nombre_visible text,
    google_sub     text        CONSTRAINT usuarios_google_sub_key UNIQUE,
    creado_en      timestamptz NOT NULL DEFAULT now(),
    actualizado_en timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT usuarios_formato_correo CHECK (correo ~ '^[^@\s]+@[^@\s]+$')
);

-- El correo es único sin distinguir mayúsculas.
CREATE UNIQUE INDEX usuarios_correo_key ON usuarios (lower(correo));

CREATE TRIGGER usuarios_establecer_actualizado_en
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();

-- -----------------------------------------------------------------------------
-- Activos (RF-01, RF-04)
-- -----------------------------------------------------------------------------

CREATE TABLE activos (
    id                    bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    simbolo               text        NOT NULL,
    nombre                text        NOT NULL,
    -- El backend lo guarda siempre en mayúsculas (NASDAQ, BMV).
    mercado               text        NOT NULL,
    categoria             text        NOT NULL,
    moneda                char(3)     NOT NULL,
    -- Última vez que se actualizaron sus precios (RF-04); nulo si nunca.
    ultima_sincronizacion timestamptz,
    creado_en             timestamptz NOT NULL DEFAULT now(),
    actualizado_en        timestamptz NOT NULL DEFAULT now(),
    -- Mismo criterio que PriceBar: sin espacios y en mayúsculas.
    CONSTRAINT activos_simbolo_normalizado CHECK (simbolo <> '' AND simbolo = upper(btrim(simbolo))),
    CONSTRAINT activos_moneda_iso          CHECK (moneda ~ '^[A-Z]{3}$'),
    -- Símbolo único dentro de su mercado (SRS 7.2).
    CONSTRAINT activos_mercado_simbolo_key UNIQUE (mercado, simbolo)
);

CREATE TRIGGER activos_establecer_actualizado_en
    BEFORE UPDATE ON activos
    FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();

-- -----------------------------------------------------------------------------
-- Precios históricos (RF-02, RF-05)
-- -----------------------------------------------------------------------------

-- Una barra OHLCV por activo, fecha y origen. Las restricciones replican los
-- invariantes de PriceBar (backend/src/domain/prices.jl).
CREATE TABLE precios_historicos (
    activo_id       bigint           NOT NULL REFERENCES activos (id) ON DELETE CASCADE,
    fecha_operacion date             NOT NULL,
    origen          origen_precio    NOT NULL,
    apertura        double precision NOT NULL,
    maximo          double precision NOT NULL,
    minimo          double precision NOT NULL,
    cierre          double precision NOT NULL,
    volumen         double precision NOT NULL,
    importado_en    timestamptz      NOT NULL DEFAULT now(),
    -- Sin duplicados para el mismo activo, fecha y origen (RF-05, SRS 7.2).
    PRIMARY KEY (activo_id, fecha_operacion, origen),
    -- 'NaN' e 'Infinity' son valores válidos de double precision, por eso se excluyen.
    CONSTRAINT precios_historicos_precios_positivos CHECK (
        apertura > 0 AND apertura < 'Infinity' AND
        maximo   > 0 AND maximo   < 'Infinity' AND
        minimo   > 0 AND minimo   < 'Infinity' AND
        cierre   > 0 AND cierre   < 'Infinity'
    ),
    CONSTRAINT precios_historicos_maximo_es_mayor CHECK (maximo >= greatest(apertura, minimo, cierre)),
    CONSTRAINT precios_historicos_minimo_es_menor CHECK (minimo <= least(apertura, cierre)),
    CONSTRAINT precios_historicos_volumen_valido  CHECK (volumen >= 0 AND volumen < 'Infinity')
);

-- -----------------------------------------------------------------------------
-- Sincronizaciones (RF-06, SRS 7.1)
-- -----------------------------------------------------------------------------

-- Registro de cada carga de datos: importación de CSV o consulta a la API.
CREATE TABLE sincronizaciones (
    id                  bigint                GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    origen              origen_precio         NOT NULL,
    -- Nulo cuando la carga no llegó a crear el activo (importación fallida).
    activo_id           bigint                REFERENCES activos (id) ON DELETE SET NULL,
    estado              estado_sincronizacion NOT NULL DEFAULT 'en_curso',
    registros_guardados integer               NOT NULL DEFAULT 0,
    registros_fallidos  integer               NOT NULL DEFAULT 0,
    mensaje_error       text,
    iniciado_en         timestamptz           NOT NULL DEFAULT now(),
    finalizado_en       timestamptz,
    CONSTRAINT sincronizaciones_conteos_validos        CHECK (registros_guardados >= 0 AND registros_fallidos >= 0),
    CONSTRAINT sincronizaciones_fin_despues_inicio     CHECK (finalizado_en IS NULL OR finalizado_en >= iniciado_en),
    -- Una sincronización terminada tiene fecha de fin; una en curso no.
    CONSTRAINT sincronizaciones_fin_coincide_con_estado CHECK ((estado = 'en_curso') = (finalizado_en IS NULL))
);

CREATE INDEX sincronizaciones_iniciado_en_idx ON sincronizaciones (iniciado_en DESC);

-- -----------------------------------------------------------------------------
-- Lista de seguimiento (RF-08)
-- -----------------------------------------------------------------------------

CREATE TABLE lista_seguimiento (
    usuario_id  uuid        NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    activo_id   bigint      NOT NULL REFERENCES activos (id) ON DELETE CASCADE,
    agregado_en timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, activo_id)
);

-- -----------------------------------------------------------------------------
-- Carteras (RF-27 a RF-33)
-- -----------------------------------------------------------------------------

CREATE TABLE carteras (
    id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      uuid           NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    nombre          text           NOT NULL,
    capital_inicial numeric(18, 2) NOT NULL,
    moneda          char(3)        NOT NULL,
    fecha_inicio    date           NOT NULL DEFAULT CURRENT_DATE,
    estado          estado_cartera NOT NULL DEFAULT 'borrador',
    -- Cartera de la que se copió, para versiones y duplicados (RF-32, RF-33).
    derivada_de_id  uuid           REFERENCES carteras (id) ON DELETE SET NULL,
    creado_en       timestamptz    NOT NULL DEFAULT now(),
    actualizado_en  timestamptz    NOT NULL DEFAULT now(),
    CONSTRAINT carteras_nombre_no_vacio  CHECK (btrim(nombre) <> ''),
    CONSTRAINT carteras_capital_positivo CHECK (capital_inicial > 0),
    CONSTRAINT carteras_moneda_iso       CHECK (moneda ~ '^[A-Z]{3}$')
);

CREATE INDEX carteras_usuario_id_idx ON carteras (usuario_id);
CREATE INDEX carteras_derivada_de_id_idx ON carteras (derivada_de_id);

CREATE TRIGGER carteras_establecer_actualizado_en
    BEFORE UPDATE ON carteras
    FOR EACH ROW EXECUTE FUNCTION establecer_actualizado_en();

-- Activo y peso dentro de una cartera (RF-28). Que los pesos sumen 100 % (RF-29) lo
-- valida el backend con Portfolio (backend/src/domain/portfolio.jl), porque es una
-- regla entre varias filas.
CREATE TABLE posiciones_cartera (
    cartera_id        uuid           NOT NULL REFERENCES carteras (id) ON DELETE CASCADE,
    activo_id         bigint         NOT NULL REFERENCES activos (id) ON DELETE RESTRICT,
    peso              numeric(9, 8)  NOT NULL,
    cantidad_estimada numeric(20, 8),
    PRIMARY KEY (cartera_id, activo_id),
    CONSTRAINT posiciones_cartera_peso_en_rango   CHECK (peso >= 0 AND peso <= 1),
    CONSTRAINT posiciones_cartera_cantidad_valida CHECK (cantidad_estimada IS NULL OR cantidad_estimada >= 0)
);

CREATE INDEX posiciones_cartera_activo_id_idx ON posiciones_cartera (activo_id);

-- -----------------------------------------------------------------------------
-- Simulaciones Monte Carlo (RF-41 a RF-48, RNF-16, RNF-17)
-- -----------------------------------------------------------------------------

-- Una corrida guardada de POST /api/risk/monte-carlo con todo lo necesario para
-- repetirla: parámetros, semilla y versión del modelo.
CREATE TABLE simulaciones (
    id                           uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id                   uuid             NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
    -- Nulo si se simuló una combinación de activos sin cartera guardada.
    cartera_id                   uuid             REFERENCES carteras (id) ON DELETE SET NULL,
    -- Identificador del modelo, por ejemplo 'normal-rebalanced-v1' (RNF-17).
    modelo                       text             NOT NULL,
    num_simulaciones             integer          NOT NULL,
    horizonte                    integer          NOT NULL,
    confianza                    double precision NOT NULL,
    semilla                      bigint           NOT NULL,
    observaciones                integer          NOT NULL,
    -- Símbolos y pesos usados, en el mismo orden: {"symbols": [...], "weights": [...]}.
    activos                      jsonb            NOT NULL,
    retorno_esperado_periodo     double precision NOT NULL,
    volatilidad_esperada_periodo double precision NOT NULL,
    -- VaR y CVaR como pérdidas positivas; duplicados del resumen para poder filtrar y ordenar.
    valor_en_riesgo              double precision NOT NULL,
    valor_en_riesgo_condicional  double precision NOT NULL,
    -- Objeto summary completo que devuelve la API (percentiles, peor y mejor resultado, etc.).
    resumen                      jsonb            NOT NULL,
    creado_en                    timestamptz      NOT NULL DEFAULT now(),
    -- Mismos límites que backend/src/services/risk.jl.
    CONSTRAINT simulaciones_num_simulaciones_rango CHECK (num_simulaciones >= 1 AND num_simulaciones <= 100000),
    CONSTRAINT simulaciones_horizonte_rango        CHECK (horizonte >= 1 AND horizonte <= 2520),
    CONSTRAINT simulaciones_confianza_rango        CHECK (confianza > 0 AND confianza < 1),
    CONSTRAINT simulaciones_observaciones_validas  CHECK (observaciones >= 3),
    CONSTRAINT simulaciones_forma_activos CHECK (
        jsonb_typeof(activos -> 'symbols') = 'array' AND
        jsonb_typeof(activos -> 'weights') = 'array' AND
        jsonb_array_length(activos -> 'symbols') >= 1 AND
        jsonb_array_length(activos -> 'symbols') = jsonb_array_length(activos -> 'weights')
    ),
    CONSTRAINT simulaciones_cvar_no_menor_que_var CHECK (valor_en_riesgo_condicional >= valor_en_riesgo),
    CONSTRAINT simulaciones_resumen_es_objeto     CHECK (jsonb_typeof(resumen) = 'object')
);

CREATE INDEX simulaciones_usuario_creado_idx ON simulaciones (usuario_id, creado_en DESC);
CREATE INDEX simulaciones_cartera_id_idx ON simulaciones (cartera_id);

-- -----------------------------------------------------------------------------
-- Seguridad: RLS activado y sin políticas (ver encabezado)
-- -----------------------------------------------------------------------------

ALTER TABLE usuarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE activos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_historicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sincronizaciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lista_seguimiento  ENABLE ROW LEVEL SECURITY;
ALTER TABLE carteras           ENABLE ROW LEVEL SECURITY;
ALTER TABLE posiciones_cartera ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulaciones       ENABLE ROW LEVEL SECURITY;

COMMIT;

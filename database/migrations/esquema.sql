-- =============================================================================
-- MarkovLab · Migración 0001: esquema inicial
--
-- Primera versión de la base de datos (PostgreSQL 15+, administrado por Supabase).
-- Cubre lo que el backend ya calcula o necesita a corto plazo:
--   usuarios, activos, precios históricos, sincronizaciones, lista de seguimiento,
--   carteras con sus posiciones y simulaciones Monte Carlo guardadas (RF-47).
-- Predicción, optimización, escenarios de estrés y backtesting llegarán en
-- migraciones posteriores.
--
-- Acceso: solo la API Julia se conecta a la base (SRS 6.5). Por eso todas las
-- tablas activan RLS sin políticas: los roles públicos de Supabase (anon,
-- authenticated) no pueden leer ni escribir nada, y el backend entra con un
-- rol que omite RLS.
--
-- Todo el script corre en una sola transacción: o se aplica completo o nada.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

-- Actualiza la columna updated_at en cada UPDATE.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------

-- Origen de un dato de precio (RF-13, RNF-10).
CREATE TYPE price_source AS ENUM ('csv', 'api', 'manual');

-- Estado de una cartera.
CREATE TYPE portfolio_status AS ENUM ('draft', 'active', 'archived');

-- Estado de una sincronización con una fuente de datos (SRS 7.1).
CREATE TYPE sync_status AS ENUM ('running', 'success', 'partial', 'failed');

-- -----------------------------------------------------------------------------
-- Usuarios
-- -----------------------------------------------------------------------------

-- Usuario de la aplicación. El inicio de sesión será con Google; google_sub es
-- el identificador estable que entrega Google ("sub" del token).
CREATE TABLE app_users (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email        text        NOT NULL,
    display_name text,
    google_sub   text        UNIQUE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT app_users_email_format CHECK (email ~ '^[^@\s]+@[^@\s]+$')
);

-- El correo es único sin distinguir mayúsculas.
CREATE UNIQUE INDEX app_users_email_key ON app_users (lower(email));

CREATE TRIGGER app_users_set_updated_at
    BEFORE UPDATE ON app_users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Activos (RF-01, RF-04)
-- -----------------------------------------------------------------------------

CREATE TABLE assets (
    id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    symbol          text        NOT NULL,
    name            text        NOT NULL,
    market          text        NOT NULL,
    category        text        NOT NULL,
    currency        char(3)     NOT NULL,
    -- Última vez que se actualizaron sus precios (RF-04); nulo si nunca.
    last_synced_at  timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    -- Mismo criterio que PriceBar: sin espacios y en mayúsculas.
    CONSTRAINT assets_symbol_normalized CHECK (symbol <> '' AND symbol = upper(btrim(symbol))),
    CONSTRAINT assets_currency_iso      CHECK (currency ~ '^[A-Z]{3}$'),
    -- Símbolo único dentro de su mercado (SRS 7.2).
    CONSTRAINT assets_market_symbol_key UNIQUE (market, symbol)
);

CREATE TRIGGER assets_set_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- Precios históricos (RF-02, RF-05)
-- -----------------------------------------------------------------------------

-- Una barra OHLCV por activo, fecha y fuente. Las restricciones replican los
-- invariantes de PriceBar (backend/src/domain/prices.jl).
CREATE TABLE price_bars (
    asset_id    bigint           NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    trade_date  date             NOT NULL,
    source      price_source     NOT NULL,
    open        double precision NOT NULL,
    high        double precision NOT NULL,
    low         double precision NOT NULL,
    close       double precision NOT NULL,
    volume      double precision NOT NULL,
    imported_at timestamptz      NOT NULL DEFAULT now(),
    -- Sin duplicados para el mismo activo, fecha y fuente (RF-05, SRS 7.2).
    -- El índice de la clave primaria sirve también para leer una serie en orden.
    PRIMARY KEY (asset_id, trade_date, source),
    -- 'NaN' e 'Infinity' son valores válidos de double precision, por eso se excluyen.
    CONSTRAINT price_bars_prices_positive CHECK (
        open  > 0 AND open  < 'Infinity' AND
        high  > 0 AND high  < 'Infinity' AND
        low   > 0 AND low   < 'Infinity' AND
        close > 0 AND close < 'Infinity'
    ),
    CONSTRAINT price_bars_high_is_max CHECK (high >= greatest(open, low, close)),
    CONSTRAINT price_bars_low_is_min  CHECK (low  <= least(open, close)),
    CONSTRAINT price_bars_volume_valid CHECK (volume >= 0 AND volume < 'Infinity')
);

-- -----------------------------------------------------------------------------
-- Sincronizaciones (RF-06, SRS 7.1)
-- -----------------------------------------------------------------------------

-- Bitácora de cada carga de datos: importación de CSV o consulta a la API.
CREATE TABLE sync_runs (
    id             bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source         price_source NOT NULL,
    -- Nulo cuando la carga abarca varios activos.
    asset_id       bigint       REFERENCES assets (id) ON DELETE SET NULL,
    status         sync_status  NOT NULL DEFAULT 'running',
    records_saved  integer      NOT NULL DEFAULT 0,
    records_failed integer      NOT NULL DEFAULT 0,
    error_message  text,
    started_at     timestamptz  NOT NULL DEFAULT now(),
    finished_at    timestamptz,
    CONSTRAINT sync_runs_counts_valid CHECK (records_saved >= 0 AND records_failed >= 0),
    CONSTRAINT sync_runs_finished_after_start CHECK (finished_at IS NULL OR finished_at >= started_at),
    -- Una sincronización terminada tiene fecha de fin; una en curso no.
    CONSTRAINT sync_runs_finished_matches_status CHECK ((status = 'running') = (finished_at IS NULL))
);

CREATE INDEX sync_runs_started_at_idx ON sync_runs (started_at DESC);

-- -----------------------------------------------------------------------------
-- Lista de seguimiento (RF-08)
-- -----------------------------------------------------------------------------

CREATE TABLE watchlist_items (
    user_id  uuid        NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
    asset_id bigint      NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, asset_id)
);

-- -----------------------------------------------------------------------------
-- Carteras (RF-27 a RF-33)
-- -----------------------------------------------------------------------------

CREATE TABLE portfolios (
    id              uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid             NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
    name            text             NOT NULL,
    initial_capital numeric(18, 2)   NOT NULL,
    currency        char(3)          NOT NULL,
    start_date      date             NOT NULL DEFAULT current_date,
    status          portfolio_status NOT NULL DEFAULT 'draft',
    -- Cartera de la que se copió, para versiones y duplicados (RF-32, RF-33).
    derived_from_id uuid             REFERENCES portfolios (id) ON DELETE SET NULL,
    created_at      timestamptz      NOT NULL DEFAULT now(),
    updated_at      timestamptz      NOT NULL DEFAULT now(),
    CONSTRAINT portfolios_name_not_blank   CHECK (btrim(name) <> ''),
    CONSTRAINT portfolios_capital_positive CHECK (initial_capital > 0),
    CONSTRAINT portfolios_currency_iso     CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX portfolios_user_id_idx ON portfolios (user_id);
CREATE INDEX portfolios_derived_from_id_idx ON portfolios (derived_from_id);

CREATE TRIGGER portfolios_set_updated_at
    BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Activo y peso dentro de una cartera (RF-28).
-- Que los pesos sumen 100 % (RF-29) lo valida el backend con Portfolio
-- (backend/src/domain/portfolio.jl), porque es una regla entre varias filas.
CREATE TABLE portfolio_positions (
    portfolio_id       uuid           NOT NULL REFERENCES portfolios (id) ON DELETE CASCADE,
    asset_id           bigint         NOT NULL REFERENCES assets (id) ON DELETE RESTRICT,
    weight             numeric(9, 8)  NOT NULL,
    estimated_quantity numeric(20, 8),
    PRIMARY KEY (portfolio_id, asset_id),
    CONSTRAINT portfolio_positions_weight_range    CHECK (weight >= 0 AND weight <= 1),
    CONSTRAINT portfolio_positions_quantity_valid  CHECK (estimated_quantity IS NULL OR estimated_quantity >= 0)
);

CREATE INDEX portfolio_positions_asset_id_idx ON portfolio_positions (asset_id);

-- -----------------------------------------------------------------------------
-- Simulaciones Monte Carlo (RF-41 a RF-48, RNF-16, RNF-17)
-- -----------------------------------------------------------------------------

-- Una corrida guardada de POST /api/risk/monte-carlo con todo lo necesario
-- para repetirla: parámetros, semilla y versión del modelo.
CREATE TABLE simulation_runs (
    id                         uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    uuid             NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
    -- Nulo si se simuló una combinación de activos sin cartera guardada.
    portfolio_id               uuid             REFERENCES portfolios (id) ON DELETE SET NULL,
    -- Identificador del modelo, por ejemplo 'normal-rebalanced-v1' (RNF-17).
    model                      text             NOT NULL,
    simulations                integer          NOT NULL,
    horizon                    integer          NOT NULL,
    confidence                 double precision NOT NULL,
    seed                       bigint           NOT NULL,
    observations               integer          NOT NULL,
    -- Símbolos y pesos usados, en el mismo orden: {"symbols": [...], "weights": [...]}.
    assets                     jsonb            NOT NULL,
    expected_period_return     double precision NOT NULL,
    expected_period_volatility double precision NOT NULL,
    -- VaR y CVaR como pérdidas positivas; duplicados de summary para poder filtrar y ordenar.
    value_at_risk              double precision NOT NULL,
    conditional_value_at_risk  double precision NOT NULL,
    -- Objeto summary completo que devuelve la API (percentiles, peor y mejor resultado, etc.).
    summary                    jsonb            NOT NULL,
    created_at                 timestamptz      NOT NULL DEFAULT now(),
    -- Mismos límites que backend/src/services/risk.jl.
    CONSTRAINT simulation_runs_simulations_range CHECK (simulations BETWEEN 1 AND 100000),
    CONSTRAINT simulation_runs_horizon_range     CHECK (horizon BETWEEN 1 AND 2520),
    CONSTRAINT simulation_runs_confidence_range  CHECK (confidence > 0 AND confidence < 1),
    CONSTRAINT simulation_runs_observations_valid CHECK (observations >= 3),
    CONSTRAINT simulation_runs_assets_shape CHECK (
        jsonb_typeof(assets -> 'symbols') = 'array' AND
        jsonb_typeof(assets -> 'weights') = 'array' AND
        jsonb_array_length(assets -> 'symbols') >= 1 AND
        jsonb_array_length(assets -> 'symbols') = jsonb_array_length(assets -> 'weights')
    ),
    CONSTRAINT simulation_runs_cvar_not_below_var CHECK (conditional_value_at_risk >= value_at_risk),
    CONSTRAINT simulation_runs_summary_is_object  CHECK (jsonb_typeof(summary) = 'object')
);

CREATE INDEX simulation_runs_user_created_idx ON simulation_runs (user_id, created_at DESC);
CREATE INDEX simulation_runs_portfolio_id_idx ON simulation_runs (portfolio_id);

-- -----------------------------------------------------------------------------
-- Seguridad: RLS activado y sin políticas (ver encabezado)
-- -----------------------------------------------------------------------------

ALTER TABLE app_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_bars          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_runs     ENABLE ROW LEVEL SECURITY;

COMMIT;

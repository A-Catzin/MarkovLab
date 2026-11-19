# Infraestructura

## Overview

Responsabilidad: adaptar archivos CSV, la API externa de mercado (Apify), almacenamiento en memoria y PostgreSQL a las necesidades de los servicios y puertos del dominio.

Contenido permitido: conectores, repositorios y traducciones de datos externos. Límite: no exponer HTTP ni decidir reglas financieras; tampoco guardar credenciales en código. Ver [`IMPORTACION_CSV.md`](../../../documentacion/tecnica/IMPORTACION_CSV.md) y [`PRECIOS_API.md`](../../../documentacion/tecnica/PRECIOS_API.md).

## Interface

- **Importación CSV de precios (`csv_prices.jl`)**:
  - `ImportIssue(line, message)`, `PriceImportResult(bars, errors, duplicates)`, `parse_prices_csv(io; columns=Dict(), symbol=nothing)`, `read_prices_csv(path; kwargs...)`, `PRICE_COLUMNS`, `PRICE_DATE_FORMAT` (`[csv_prices.jl:parse_prices_csv]`, `[csv_prices.jl:read_prices_csv]`).
- **Fuente externa Apify (`apify_market_data.jl`)**:
  - `ApifyMarketData(token; actor=APIFY_ACTOR, timeout=APIFY_TIMEOUT_SECONDS)`, `fetch_daily_prices(source::ApifyMarketData, symbols, from::Date, to::Date) -> Vector{MarketSeries}`, `APIFY_ACTOR` (`"kaix~yahoo-finance-scraper"`), `APIFY_BATCH_SIZE` (`5`), `APIFY_MEMORY_MB` (`1024`), `YAHOO_MARKETS`, `YAHOO_CATEGORIES` (`[apify_market_data.jl:ApifyMarketData]`, `[apify_market_data.jl:fetch_daily_prices]`).
- **Conexión PostgreSQL compartida (`postgres.jl`)**:
  - `PostgresConnection(url)`, `connection!(db)`, `Base.close(db)`, `with_connection(f, db)`, `in_transaction(f, conn)`, `run_query(conn, sql, params=())`, `set_user_timeout!`, `is_connection_error`, `DATABASE_URL_PATTERN`, `CONNECTION_PARAMS` (`[postgres.jl:PostgresConnection]`, `[postgres.jl:with_connection]`, `[postgres.jl:run_query]`, `[postgres.jl:in_transaction]`).
- **Repositorios de usuarios (`memory_users.jl`, `postgres_users.jl`)**:
  - `InMemoryUserRepository()`, `PostgresUserRepository(url)`, `save_google_user`, `find_user`, `list_users`, `set_user_role`, `UPSERT_GOOGLE_USER_SQL`, `LOCK_ADMINS_SQL`, `SET_ROLE_SQL` (`[memory_users.jl:InMemoryUserRepository]`, `[postgres_users.jl:PostgresUserRepository]`, `[postgres_users.jl:set_user_role]`).
- **Repositorios de precios y divisas (`memory_prices.jl`, `postgres_prices.jl`)**:
  - `InMemoryPriceRepository()`, `PostgresPriceRepository(url)`, `save_price_import(..., source=:csv)`, `list_assets`, `list_imports(prices; limit=50)`, `latest_price_date(prices, symbol; source=:api)`, `price_history(prices, asset_id)`, `save_exchange_rates`, `exchange_rates`, `latest_exchange_rate_date` (`[memory_prices.jl:save_price_import]`, `[postgres_prices.jl:save_price_import]`, `[postgres_prices.jl:exchange_rates]`).
- **Repositorios de carteras (`memory_portfolios.jl`, `postgres_portfolios.jl`)**:
  - `InMemoryPortfolioRepository(prices)`, `PostgresPortfolioRepository(url)`, `create_portfolio`, `list_portfolios`, `get_portfolio`, `delete_portfolio` (`[memory_portfolios.jl:InMemoryPortfolioRepository]`, `[postgres_portfolios.jl:PostgresPortfolioRepository]`).
- **Repositorios de simulaciones (`memory_simulations.jl`, `postgres_simulations.jl`)**:
  - `InMemorySimulationRepository()`, `PostgresSimulationRepository(url)`, `save_simulation`, `list_simulations(simulations, user_id, portfolio_id; limit=20)` (`[memory_simulations.jl:InMemorySimulationRepository]`, `[postgres_simulations.jl:PostgresSimulationRepository]`).

## Invariants

- `parse_prices_csv` exige columnas `PRICE_COLUMNS` (o `symbol`), registra inválidas en `errors` y duplicados `(symbol, date)` en `duplicates` conservando la primera aparición, y ordena `bars` por `(symbol, date)` (`[csv_prices.jl:parse_prices_csv]`).
- `ApifyMarketData` oculta `token` en `Base.show` (`token=<oculto>`), solicita barras diarias en tandas de `APIFY_BATCH_SIZE` (`5`) símbolos con `1024 MB`, descarta la barra del día en curso del mercado y convierte días con `open`/`high`/`low` inválidos pero `close` válido en barras planas registradas en `MarketSeries.corrected` (`[apify_market_data.jl:ApifyMarketData]`, `[apify_market_data.jl:fetch_daily_prices]`, `[apify_market_data.jl:parse_actor_item]`).
- Todos los adaptadores de usuario garantizan un único `AppUser` por `google_sub`, correo único (`EmailConflictError`) y al menos un administrador (`LastAdminError` usando `FOR UPDATE` sobre administradores en `PostgresUserRepository`) (`[memory_users.jl:set_user_role]`, `[postgres_users.jl:LOCK_ADMINS_SQL]`).
- `PostgresConnection` (usada por `PostgresUserRepository`, `PostgresPriceRepository`, `PostgresPortfolioRepository` y `PostgresSimulationRepository`) valida `postgresql://...`, serializa operaciones con `ReentrantLock`, ejecuta todas las consultas vía `run_query` (`LibPQ.async_execute`) sin bloquear el hilo de Julia, aplica `CONNECTION_PARAMS` + `set_user_timeout!` y reintenta una vez solo en errores de conexión (`is_connection_error`) (`[postgres.jl:PostgresConnection]`, `[postgres.jl:run_query]`, `[postgres.jl:with_connection]`).
- `PostgresPriceRepository` y `PostgresPortfolioRepository` ejecutan altas de importaciones/carteras de forma transaccional atómica (`in_transaction`), respetando unicidad de precios y tipos de cambio por `(clave, fecha, origen)` y pertenencia estricta por `usuario_id` (`[postgres_prices.jl:save_price_import]`, `[postgres_portfolios.jl:create_portfolio]`).

## Side Effects

- `read_prices_csv` lee archivos CSV locales (`[csv_prices.jl:read_prices_csv]`).
- `ApifyMarketData` realiza solicitudes HTTPS `POST` a `api.apify.com` enviando `Authorization: Bearer <token>` (`[apify_market_data.jl:run_actor]`).
- `InMemoryUserRepository` usa `Random.RandomDevice()` (entropía del SO) para generar UUID v4 en entornos concurrentes (`[memory_users.jl:random_uuid]`); los repositorios en memoria mutan sus estructuras internas protegidos por `ReentrantLock`.
- Los cuatro repositorios PostgreSQL abren y mantienen conexiones TLS/TCP vía `LibPQ` y leen/escriben sobre las tablas `usuarios`, `activos`, `precios_historicos`, `sincronizaciones`, `tipos_cambio`, `carteras`, `posiciones_cartera` y `simulaciones` (`[postgres_users.jl:save_google_user]`, `[postgres_prices.jl:save_price_import]`, `[postgres_portfolios.jl:create_portfolio]`, `[postgres_simulations.jl:save_simulation]`).

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

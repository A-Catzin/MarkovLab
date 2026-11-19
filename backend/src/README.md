# Código fuente (`src`)

## Overview

Responsabilidad: alojar el módulo raíz `MarkovLabBackend.jl`, la carga de precompilación `precompile.jl` y sus capas `domain/`, `infrastructure/`, `services/` y `api/`.

Contenido permitido: código Julia del paquete, organizado según la responsabilidad de cada capa. Límite: no poner aquí pruebas, credenciales, scripts de despliegue ni migraciones; `MarkovLabBackend.jl` incluye los archivos de cada capa en orden de dependencia y exporta su interfaz pública.

## Interface

- **Módulo raíz (`MarkovLabBackend.jl`)**:
  - `MarkovLabBackend` (`[MarkovLabBackend.jl:MarkovLabBackend]`):
    - Dominio financiero y errores: `InsufficientDataError`, `simple_returns`, `log_returns`, `cumulative_return`, `mean_return`, `volatility`, `drawdowns`, `max_drawdown`, `correlation`, `correlation_matrix`, `PriceBar`, `Portfolio`, `PORTFOLIO_WEIGHT_TOLERANCE`, `covariance_matrix`, `portfolio_returns`, `portfolio_return`, `portfolio_volatility`, `empirical_quantile`, `value_at_risk`, `conditional_value_at_risk`, `summarize_outcomes`, `simulate_portfolio_returns`, `price_history`, `portfolio_value_history`, `aligned_prices` (`[MarkovLabBackend.jl:export]`).
    - Dominio de usuarios, roles, activos, carteras, simulaciones, mercado y divisas: `GoogleProfile`, `AppUser`, `EmailConflictError`, `UserRepository`, `save_google_user`, `USER_ROLES`, `parse_role`, `ForbiddenError`, `LastAdminError`, `find_user`, `list_users`, `set_user_role`, `AssetDetails`, `PriceRepository`, `save_price_import`, `IMPORT_STATUSES`, `PRICE_SOURCES`, `latest_price_date`, `MarketSeries`, `MarketDataSource`, `MarketDataError`, `fetch_daily_prices`, `PositionDraft`, `PortfolioDraft`, `SavedPosition`, `SavedPortfolio`, `PortfolioRepository`, `create_portfolio`, `list_portfolios`, `get_portfolio`, `delete_portfolio`, `SavedSimulation`, `SimulationRepository`, `save_simulation`, `list_simulations`, `EXCHANGE_RATE_SYMBOLS`, `MAX_RATE_GAP_DAYS`, `MissingExchangeRateError`, `convert_series`, `save_exchange_rates`, `exchange_rates`, `latest_exchange_rate_date` (`[MarkovLabBackend.jl:export]`).
    - Infraestructura exportada: `ImportIssue`, `PriceImportResult`, `parse_prices_csv`, `read_prices_csv`, `ApifyMarketData`, `InMemoryUserRepository`, `PostgresUserRepository`, `InMemoryPriceRepository`, `PostgresPriceRepository`, `InMemoryPortfolioRepository`, `PostgresPortfolioRepository`, `InMemorySimulationRepository`, `PostgresSimulationRepository` (`[MarkovLabBackend.jl:export]`).
    - Servicios exportados: `analyze_prices`, `run_monte_carlo`, `MONTE_CARLO_MODEL`, `MAX_SIMULATIONS`, `MAX_HORIZON`, `sync_google_user`, `PriceImportSummary`, `import_prices`, `list_assets`, `list_imports`, `require_admin`, `change_user_role`, `admin_summary`, `require_user`, `create_user_portfolio`, `list_user_portfolios`, `get_user_portfolio`, `delete_user_portfolio`, `user_portfolio_history`, `sync_market_prices`, `sync_exchange_rates`, `MARKET_HISTORY_START`, `MAX_SYNC_SYMBOLS`, `simulate_user_portfolio`, `list_user_simulations`, `DEFAULT_LOOKBACK_YEARS`, `MAX_LOOKBACK_YEARS`, `MIN_SIMULATION_DAYS` (`[MarkovLabBackend.jl:export]`).
    - Submódulo de transporte HTTP: `MarkovLabBackend.Api` (`[MarkovLabBackend.jl:include("api/Api.jl")]`).
- **Precompilación (`precompile.jl`)**:
  - `precompile_workload()` (`[precompile.jl:precompile_workload]`): Ejecuta las rutas principales con repositorios en memoria (incluyendo conversión de moneda) cuando `jl_generating_output` está activo, para acelerar el arranque en frío en contenedores.
- **Subdirectorios y contratos de capas**:
  - [`api`](./api/README.md): Transporte HTTP/JSON con Oxygen.jl (`17` rutas), control `X-Internal-Key` / `X-Actor-Id`, CORS y precalentamiento de PostgreSQL (`warm_database`).
  - [`domain`](./domain/README.md): Modelos puros, invariantes y cálculos de métricas, carteras, historia, simulación Monte Carlo, conversión cambiaria, usuarios, activos y mercado.
  - [`infrastructure`](./infrastructure/README.md): Importación CSV, adaptador de Apify (`ApifyMarketData`), conexión compartida `PostgresConnection` (`LibPQ.async_execute`) y repositorios en memoria / PostgreSQL.
  - [`services`](./services/README.md): Casos de uso de análisis, riesgo, importación, sincronización de mercado y divisas, carteras, simulaciones persistidas, usuarios y administración.

## Invariants

- `MarkovLabBackend.jl` carga las capas en orden de dependencia (`domain` -> `infrastructure` -> `services` -> `api`), incluyendo `csv_prices.jl` antes de `market_data.jl` porque `MarketSeries` reutiliza `ImportIssue`, y al final `precompile.jl` (`[MarkovLabBackend.jl:MarkovLabBackend]`).
- `precompile_workload()` solo corre durante la precompilación (`ccall(:jl_generating_output, Cint, ()) == 1`) y siempre limpia la configuración de `Api` en su bloque `finally` para no dejar estado residual en el paquete (`[precompile.jl:precompile_workload]`).
- Todos los invariantes de validación de datos, pesos de cartera, límites de simulación, conversión de divisas, roles y unicidad de usuarios documentados en [`./domain/README.md`](./domain/README.md), [`./infrastructure/README.md`](./infrastructure/README.md), [`./services/README.md`](./services/README.md) y [`./api/README.md`](./api/README.md) rigen sobre los símbolos exportados.

## Side Effects

- La invocación de adaptadores de infraestructura, servicios o `MarkovLabBackend.Api.start()` realiza lectura de archivos CSV locales, llamadas HTTPS a Apify (`ApifyMarketData`), consultas SQL sobre PostgreSQL (`LibPQ`), lectura de entropía del sistema (`Random.RandomDevice`) o apertura del servidor HTTP (`[MarkovLabBackend.jl:MarkovLabBackend]`).

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

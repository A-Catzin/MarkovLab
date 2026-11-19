# Servicios

## Overview

Responsabilidad: coordinar casos de uso entre dominio e infraestructura.

Contenido permitido: orquestación y validaciones de aplicación independientes del transporte. Límite: no definir rutas HTTP, implementar conectores externos ni duplicar cálculos del dominio. Los contratos HTTP que usan estos servicios están en [`API.md`](../../../documentacion/tecnica/API.md).

## Interface

- **Análisis de precios (`analysis.jl`)**:
  - `analyze_prices(prices; periods_per_year=nothing) -> NamedTuple` (`[analysis.jl:analyze_prices]`): Resumen de métricas (`observations`, `cumulative_return`, `mean_return`, `volatility`, `annualized_volatility`, `max_drawdown`).
- **Riesgo Monte Carlo (`risk.jl`)**:
  - `run_monte_carlo(portfolio, prices; simulations=DEFAULT_SIMULATIONS, horizon=DEFAULT_HORIZON, confidence=DEFAULT_CONFIDENCE, seed=nothing) -> NamedTuple` (`[risk.jl:run_monte_carlo]`): Estima rendimientos y covarianza históricos, simula y devuelve resumen + parámetros.
  - Constantes: `MONTE_CARLO_MODEL` (`"normal-rebalanced-v1"`), `DEFAULT_SIMULATIONS` (`10_000`), `DEFAULT_HORIZON` (`1`), `DEFAULT_CONFIDENCE` (`0.95`), `MAX_SIMULATIONS` (`100_000`), `MAX_HORIZON` (`2_520`) (`[risk.jl:MONTE_CARLO_MODEL]`, `[risk.jl:MAX_SIMULATIONS]`, `[risk.jl:MAX_HORIZON]`).
- **Importación de precios (`prices.jl`)**:
  - `PriceImportSummary`, `import_prices(prices::PriceRepository, io, details::AssetDetails; symbol=nothing, columns=Dict()) -> PriceImportSummary` (`[prices.jl:PriceImportSummary]`, `[prices.jl:import_prices]`): Importa un CSV de un solo activo registrando el resumen de la corrida.
- **Sincronización de mercado y divisas (`market_sync.jl`)**:
  - `MARKET_HISTORY_START` (`Date(2000, 1, 1)`), `MAX_SYNC_SYMBOLS` (`50`), `sync_market_prices(prices, source, symbols; from=nothing, to=today()-Day(1))`, `sync_exchange_rates(prices, source; from=nothing, to=today()-Day(1))` (`[market_sync.jl:MARKET_HISTORY_START]`, `[market_sync.jl:MAX_SYNC_SYMBOLS]`, `[market_sync.jl:sync_market_prices]`, `[market_sync.jl:sync_exchange_rates]`).
- **Carteras de usuario e historial (`portfolios.jl`)**:
  - `require_user(users, actor_id)`, `create_user_portfolio`, `list_user_portfolios`, `get_user_portfolio`, `delete_user_portfolio`, `portfolio_price_series(prices, portfolio)`, `user_portfolio_history(users, portfolios, prices, actor_id, id)` (`[portfolios.jl:require_user]`, `[portfolios.jl:portfolio_price_series]`, `[portfolios.jl:user_portfolio_history]`).
- **Simulaciones de carteras guardadas (`portfolio_simulations.jl`)**:
  - `DEFAULT_LOOKBACK_YEARS` (`5`), `MAX_LOOKBACK_YEARS` (`20`), `MIN_SIMULATION_DAYS` (`60`), `simulate_user_portfolio(...)`, `list_user_simulations(...)` (`[portfolio_simulations.jl:DEFAULT_LOOKBACK_YEARS]`, `[portfolio_simulations.jl:simulate_user_portfolio]`, `[portfolio_simulations.jl:list_user_simulations]`).
- **Usuarios y administración (`users.jl`, `admin.jl`)**:
  - `sync_google_user(users, profile)` (`[users.jl:sync_google_user]`), `require_admin(users, actor_id)`, `change_user_role(users, actor_id, target_id, role)`, `admin_summary(users, prices)` (`[admin.jl:require_admin]`, `[admin.jl:change_user_role]`, `[admin.jl:admin_summary]`).

## Invariants

- `analyze_prices` exige al menos 3 precios (`InsufficientDataError`); `run_monte_carlo` exige series de igual longitud (`>= 2`), `1 <= simulations <= 100_000`, `1 <= horizon <= 2_520` y `0 < confidence < 1` (`[analysis.jl:analyze_prices]`, `[risk.jl:run_monte_carlo]`).
- `import_prices` rechaza archivos con varios símbolos o símbolo distinto al esperado (`[prices.jl:import_prices]`).
- `sync_market_prices` y `sync_exchange_rates` omiten consultas cuando el símbolo o divisa ya está al día hasta `to` (ayer por defecto) y registran `:failed` si `MarketDataSource` falla (`[market_sync.jl:sync_market_prices]`, `[market_sync.jl:sync_exchange_rates]`).
- `require_user` y `require_admin` consultan el estado actual del actor en `UserRepository` lanzando `ForbiddenError` si no existe o carece de rol `:admin`; cada operación de carteras y simulaciones restringe acceso al propietario (`[portfolios.jl:require_user]`, `[admin.jl:require_admin]`).
- `portfolio_price_series` convierte todas las posiciones a `portfolio.currency` antes de calcular historia o simulación, exigiendo al menos `MIN_SIMULATION_DAYS` (`60`) días hábiles alineados en `simulate_user_portfolio` (`[portfolios.jl:portfolio_price_series]`, `[portfolio_simulations.jl:simulate_user_portfolio]`).

## Side Effects

- Si `seed === nothing`, `run_monte_carlo` genera una semilla `UInt32` desde `Random.RandomDevice()` (`[risk.jl:run_monte_carlo]`).
- Los casos de uso de escritura mutan `UserRepository`, `PriceRepository`, `PortfolioRepository` o `SimulationRepository` e invocan `MarketDataSource` durante la sincronización de mercado y divisas (`[users.jl:sync_google_user]`, `[market_sync.jl:sync_market_prices]`, `[portfolios.jl:create_user_portfolio]`, `[portfolio_simulations.jl:simulate_user_portfolio]`).

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

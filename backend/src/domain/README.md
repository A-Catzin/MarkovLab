# Dominio

## Overview

Responsabilidad: definir modelos, puertos y reglas financieras, de mercado y de usuarios independientes de servicios externos.

Contenido permitido: tipos, invariantes, puertos abstractos y cálculos puros con pruebas reproducibles. Límite: no recibir HTTP, consultar proveedores externos ni acceder a archivos o PostgreSQL; esas operaciones pertenecen a infraestructura y transporte.

Fórmulas, supuestos y ejemplos en [`METRICAS_DOMINIO.md`](../../../documentacion/tecnica/METRICAS_DOMINIO.md), [`CARTERAS_DOMINIO.md`](../../../documentacion/tecnica/CARTERAS_DOMINIO.md), [`SIMULACION_RIESGO.md`](../../../documentacion/tecnica/SIMULACION_RIESGO.md), [`IMPORTACION_CSV.md`](../../../documentacion/tecnica/IMPORTACION_CSV.md), [`ROLES.md`](../../../documentacion/tecnica/ROLES.md) y [`CARTERAS.md`](../../../documentacion/tecnica/CARTERAS.md).

## Interface

- **Errores (`errors.jl`)**:
  - `InsufficientDataError(required, available, context)`, `require_observations(values, required, context)` (`[errors.jl:InsufficientDataError]`, `[errors.jl:require_observations]`).
- **Métricas financieras (`metrics.jl`)**:
  - `simple_returns(prices)`, `log_returns(prices)`, `cumulative_return(returns)`, `mean_return(returns)`, `volatility(returns; periods_per_year=nothing)`, `drawdowns(prices)`, `max_drawdown(prices)`, `correlation(a, b)`, `correlation_matrix(returns)` (`[metrics.jl:simple_returns]`, `[metrics.jl:correlation_matrix]`).
- **Precios históricos (`prices.jl`)**:
  - `PriceBar(symbol, date, open, high, low, close, volume, adj_close=nothing)` (`[prices.jl:PriceBar]`).
- **Activos y puerto de precios (`assets.jl`)**:
  - `CURRENCY_PATTERN`, `AssetDetails(name, market, category, currency)`, `IMPORT_STATUSES` (`(:success, :partial, :failed)`), `PRICE_SOURCES` (`(:csv, :api)`), `PriceRepository`, `save_price_import`, `latest_price_date`, `price_history`, `list_assets`, `list_imports`, `check_import` (`[assets.jl:AssetDetails]`, `[assets.jl:PriceRepository]`, `[assets.jl:check_import]`).
- **Tipos de cambio (`exchange_rates.jl`)**:
  - `EXCHANGE_RATE_SYMBOLS` (`Dict("MXN" => "MXN=X", "EUR" => "EUR=X")`), `MAX_RATE_GAP_DAYS` (`5`), `MissingExchangeRateError(from, to)`, `save_exchange_rates`, `exchange_rates`, `latest_exchange_rate_date`, `check_exchange_rates`, `convert_series(series, from, to, rates; max_gap=MAX_RATE_GAP_DAYS)` (`[exchange_rates.jl:EXCHANGE_RATE_SYMBOLS]`, `[exchange_rates.jl:MissingExchangeRateError]`, `[exchange_rates.jl:convert_series]`).
- **Fuentes de mercado (`market_data.jl`)**:
  - `MarketSeries(symbol, details, bars, invalid, error, corrected=ImportIssue[])`, `MarketDataSource`, `MarketDataError(message)`, `fetch_daily_prices` (`[market_data.jl:MarketSeries]`, `[market_data.jl:MarketDataSource]`, `[market_data.jl:MarketDataError]`).
- **Carteras de cálculo (`portfolio.jl`)**:
  - `Portfolio(symbols, weights)` / `Portfolio(allocation)`, `PORTFOLIO_WEIGHT_TOLERANCE` (`1e-6`), `covariance_matrix(returns; periods_per_year=nothing)`, `portfolio_returns(weights_or_portfolio, returns)`, `portfolio_return(weights_or_portfolio, expected_returns)`, `portfolio_volatility(weights_or_portfolio, covariance)` (`[portfolio.jl:Portfolio]`, `[portfolio.jl:PORTFOLIO_WEIGHT_TOLERANCE]`, `[portfolio.jl:portfolio_volatility]`).
- **Carteras guardadas (`saved_portfolios.jl`)**:
  - `MAX_PORTFOLIO_NAME_LENGTH` (`120`), `MAX_PORTFOLIO_POSITIONS` (`50`), `MIN_PORTFOLIO_CAPITAL` (`0.01`), `MAX_PORTFOLIO_CAPITAL` (`1e15`), `PositionDraft(asset_id, weight)`, `PortfolioDraft(name, capital, currency, positions)`, `SavedPosition`, `SavedPortfolio`, `PortfolioRepository`, `create_portfolio`, `list_portfolios`, `get_portfolio`, `delete_portfolio` (`[saved_portfolios.jl:PortfolioDraft]`, `[saved_portfolios.jl:SavedPortfolio]`, `[saved_portfolios.jl:PortfolioRepository]`).
- **Historia y alineación de series (`portfolio_history.jl`)**:
  - `portfolio_value_history(prices, weights, capital, anchor::Date)`, `aligned_prices(prices; from::Date, min_days::Integer)` (`[portfolio_history.jl:portfolio_value_history]`, `[portfolio_history.jl:aligned_prices]`).
- **Simulación, riesgo y simulaciones guardadas (`simulation.jl`, `saved_simulations.jl`)**:
  - `SUMMARY_PERCENTILES` (`(1, 5, 25, 50, 75, 95, 99)`), `empirical_quantile`, `value_at_risk`, `conditional_value_at_risk`, `summarize_outcomes`, `simulate_portfolio_returns` (`[simulation.jl:simulate_portfolio_returns]`).
  - `SavedSimulation`, `summary_dict(summary)`, `SimulationRepository`, `save_simulation`, `list_simulations` (`[saved_simulations.jl:SavedSimulation]`, `[saved_simulations.jl:SimulationRepository]`).
- **Usuarios y roles (`users.jl`)**:
  - `GoogleProfile(subject, email, name)`, `AppUser(id, email, display_name, role=:user)`, `USER_ROLES` (`(:user, :admin)`), `parse_role`, `ForbiddenError`, `LastAdminError`, `EmailConflictError`, `UserRepository`, `save_google_user`, `find_user`, `list_users`, `set_user_role`, `EMAIL_PATTERN`, `MAX_GOOGLE_SUBJECT_LENGTH` (`255`) (`[users.jl:AppUser]`, `[users.jl:USER_ROLES]`, `[users.jl:parse_role]`, `[users.jl:ForbiddenError]`, `[users.jl:LastAdminError]`, `[users.jl:UserRepository]`).

## Invariants

- Capa de dominio pura: sin efectos de entrada/salida, red ni base de datos (`[metrics.jl:simple_returns]`, `[portfolio.jl:Portfolio]`, `[simulation.jl:simulate_portfolio_returns]`).
- Cantidad mínima de observaciones exigida mediante `InsufficientDataError`: al menos 1 observación para `cumulative_return`, `mean_return`, `drawdowns`, `portfolio_returns`, `empirical_quantile`, `summarize_outcomes` y `portfolio_value_history` (y al menos 2 días en común para las curvas de historia); al menos 2 observaciones para `simple_returns`, `log_returns`, `volatility`, `max_drawdown`, `correlation`, `correlation_matrix` y `covariance_matrix` (`[errors.jl:require_observations]`, `[portfolio_history.jl:portfolio_value_history]`).
- Todos los precios deben ser finitos y estrictamente positivos (`> 0`); `PriceBar` normaliza `symbol` (sin espacios, en mayúsculas y no vacío) y exige `high >= max(open, low, close)`, `low <= min(open, close)`, `volume >= 0` y `adj_close` positivo y finito cuando se provee (`[prices.jl:PriceBar]`).
- `AssetDetails` normaliza `market` y `currency` a mayúsculas y exige código ISO de 3 letras (`CURRENCY_PATTERN`) sin caracteres de control (`[assets.jl:AssetDetails]`).
- `Portfolio` y `PortfolioDraft` exigen pesos finitos en `[0, 1]` que sumen `1.0` dentro de `PORTFOLIO_WEIGHT_TOLERANCE` (`1e-6`) sin posiciones cortas ni reescalado; `PortfolioDraft` restringe además nombre (`<= 120`), capital (`[0.01, 1e15]`), moneda ISO y `1..50` activos únicos (`[portfolio.jl:Portfolio]`, `[saved_portfolios.jl:PortfolioDraft]`).
- `convert_series` utiliza `USD` como moneda puente, rellena huecos de tipo de cambio hasta `MAX_RATE_GAP_DAYS` (`5` días hábiles) y lanza `MissingExchangeRateError` si falta la serie necesaria (`[exchange_rates.jl:convert_series]`, `[exchange_rates.jl:usd_rate_lookup]`).
- `portfolio_value_history` arrastra el último precio conocido en días no cotizados y ancla los títulos en `anchor`; `aligned_prices` conserva únicamente los días en que todos los activos cotizaron (`[portfolio_history.jl:portfolio_value_history]`, `[portfolio_history.jl:aligned_prices]`).
- `GoogleProfile` valida correo (`EMAIL_PATTERN`) y `subject` (`<= 255`); `AppUser` y `parse_role` solo aceptan `USER_ROLES` (`:user`, `:admin`) (`[users.jl:GoogleProfile]`, `[users.jl:AppUser]`).

## Side Effects

- None

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

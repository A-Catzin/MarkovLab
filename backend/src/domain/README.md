# Dominio

## Overview

Responsabilidad: definir modelos y reglas financieras y de usuarios independientes de servicios externos.

Contenido permitido: tipos, invariantes y cálculos puros con pruebas reproducibles. Límite: no recibir HTTP, consultar proveedores ni persistir datos; esas operaciones pertenecen a otras capas.

Fórmulas, supuestos y ejemplos en [`METRICAS_DOMINIO.md`](../../../documentacion/tecnica/METRICAS_DOMINIO.md), [`CARTERAS_DOMINIO.md`](../../../documentacion/tecnica/CARTERAS_DOMINIO.md), [`SIMULACION_RIESGO.md`](../../../documentacion/tecnica/SIMULACION_RIESGO.md) e [`IMPORTACION_CSV.md`](../../../documentacion/tecnica/IMPORTACION_CSV.md).

## Interface

- **Errores (`errors.jl`)**:
  - `InsufficientDataError(required, available, context)` (`[errors.jl:InsufficientDataError]`), `require_observations(values, required, context)` (`[errors.jl:require_observations]`).
- **Métricas financieras (`metrics.jl`)**:
  - `simple_returns(prices)` (`[metrics.jl:simple_returns]`), `log_returns(prices)` (`[metrics.jl:log_returns]`), `cumulative_return(returns)` (`[metrics.jl:cumulative_return]`), `mean_return(returns)` (`[metrics.jl:mean_return]`), `volatility(returns; periods_per_year=nothing)` (`[metrics.jl:volatility]`), `drawdowns(prices)` (`[metrics.jl:drawdowns]`), `max_drawdown(prices)` (`[metrics.jl:max_drawdown]`), `correlation(a, b)` (`[metrics.jl:correlation]`), `correlation_matrix(returns)` (`[metrics.jl:correlation_matrix]`).
- **Precios históricos (`prices.jl`)**:
  - `PriceBar(symbol, date, open, high, low, close, volume)` (`[prices.jl:PriceBar]`).
- **Carteras (`portfolio.jl`)**:
  - `Portfolio(symbols, weights)` / `Portfolio(allocation)` (`[portfolio.jl:Portfolio]`), `PORTFOLIO_WEIGHT_TOLERANCE` (`1e-6`) (`[portfolio.jl:PORTFOLIO_WEIGHT_TOLERANCE]`), `covariance_matrix(returns; periods_per_year=nothing)` (`[portfolio.jl:covariance_matrix]`), `portfolio_returns(weights_or_portfolio, returns)` (`[portfolio.jl:portfolio_returns]`), `portfolio_return(weights_or_portfolio, expected_returns)` (`[portfolio.jl:portfolio_return]`), `portfolio_volatility(weights_or_portfolio, covariance)` (`[portfolio.jl:portfolio_volatility]`).
- **Simulación y riesgo (`simulation.jl`)**:
  - `SUMMARY_PERCENTILES` (`(1, 5, 25, 50, 75, 95, 99)`) (`[simulation.jl:SUMMARY_PERCENTILES]`), `empirical_quantile(values, p)` (`[simulation.jl:empirical_quantile]`), `value_at_risk(outcomes; confidence=0.95)` (`[simulation.jl:value_at_risk]`), `conditional_value_at_risk(outcomes; confidence=0.95)` (`[simulation.jl:conditional_value_at_risk]`), `summarize_outcomes(outcomes; confidence=0.95)` (`[simulation.jl:summarize_outcomes]`), `simulate_portfolio_returns(weights_or_portfolio, expected_returns, covariance; simulations=10_000, horizon=1, seed=nothing)` (`[simulation.jl:simulate_portfolio_returns]`).
- **Usuarios (`users.jl`)**:
  - `GoogleProfile(subject, email, name)` (`[users.jl:GoogleProfile]`), `AppUser(id, email, display_name)` (`[users.jl:AppUser]`), `EmailConflictError(email)` (`[users.jl:EmailConflictError]`), `UserRepository` (`[users.jl:UserRepository]`), `save_google_user` (`[users.jl:save_google_user]`), `EMAIL_PATTERN`, `MAX_GOOGLE_SUBJECT_LENGTH` (`255`) (`[users.jl:EMAIL_PATTERN]`, `[users.jl:MAX_GOOGLE_SUBJECT_LENGTH]`).

## Invariants

- Capa de dominio pura: sin efectos de entrada/salida, red ni base de datos (`[metrics.jl:simple_returns]`, `[portfolio.jl:Portfolio]`, `[simulation.jl:simulate_portfolio_returns]`).
- Cantidad mínima de observaciones exigida mediante `InsufficientDataError`: al menos 1 observación para `cumulative_return`, `mean_return`, `drawdowns`, `portfolio_returns`, `empirical_quantile` y `summarize_outcomes`; al menos 2 observaciones para `simple_returns`, `log_returns`, `volatility`, `max_drawdown`, `correlation`, `correlation_matrix` y `covariance_matrix` (`[errors.jl:require_observations]`).
- Todos los precios deben ser finitos y estrictamente positivos (`> 0`), los rendimientos y resultados deben ser finitos, `periods_per_year` debe ser `> 0`, y `correlation` exige series de igual longitud con varianza no nula (`>= 2` activos en `correlation_matrix`) (`[metrics.jl:validate_prices]`, `[metrics.jl:validate_finite]`, `[metrics.jl:volatility]`, `[metrics.jl:correlation]`, `[metrics.jl:correlation_matrix]`).
- `PriceBar` normaliza `symbol` (sin espacios, en mayúsculas y no vacío) y exige `open`, `high`, `low`, `close` finitos y positivos con `high >= max(open, low, close)`, `low <= min(open, close)` y `volume` finito `>= 0` (`[prices.jl:PriceBar]`).
- `Portfolio` exige al menos un activo, igual cantidad de símbolos y pesos, símbolos normalizados únicos y no vacíos, pesos finitos en `[0, 1]` sin posiciones cortas, y suma de pesos igual a `1` dentro de `PORTFOLIO_WEIGHT_TOLERANCE` (`1e-6`) sin reescalar; `portfolio_volatility` exige matriz de covarianza cuadrada y simétrica (`atol=1e-12`) (`[portfolio.jl:Portfolio]`, `[portfolio.jl:PORTFOLIO_WEIGHT_TOLERANCE]`, `[portfolio.jl:portfolio_volatility]`).
- Las funciones de riesgo y simulación exigen `0 < confidence < 1`, `0 <= p <= 1`, `simulations >= 1` y `horizon >= 1`; cuando se pasa `seed`, `simulate_portfolio_returns` usa `Random.Xoshiro(seed)` para reproducibilidad determinista (`[simulation.jl:validate_confidence]`, `[simulation.jl:empirical_quantile]`, `[simulation.jl:simulate_portfolio_returns]`).
- `GoogleProfile` rechaza caracteres de control en cualquier campo, exige `subject` no vacío con longitud `<= MAX_GOOGLE_SUBJECT_LENGTH` (`255`), normaliza `email` a minúsculas validando `EMAIL_PATTERN` (`^[^@\s]+@[^@\s]+$`), y convierte `name` vacío en `nothing` (`[users.jl:GoogleProfile]`, `[users.jl:EMAIL_PATTERN]`, `[users.jl:MAX_GOOGLE_SUBJECT_LENGTH]`).

## Side Effects

- None

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

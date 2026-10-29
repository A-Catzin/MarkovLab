# Servicios

## Overview

Responsabilidad: coordinar casos de uso entre dominio e infraestructura.

Contenido permitido: orquestación y validaciones de aplicación independientes del transporte. Límite: no definir rutas HTTP, implementar conectores externos ni duplicar cálculos del dominio. Los contratos HTTP que usan estos servicios están en [`API.md`](../../../documentacion/tecnica/API.md).

## Interface

- **Análisis de precios (`analysis.jl`)**:
  - `analyze_prices(prices; periods_per_year=nothing) -> NamedTuple` (`[analysis.jl:analyze_prices]`): Resumen de métricas principales (`observations`, `cumulative_return`, `mean_return`, `volatility`, `annualized_volatility`, `max_drawdown`) de una serie de precios.
- **Riesgo y simulación Monte Carlo (`risk.jl`)**:
  - `run_monte_carlo(portfolio, prices; simulations=DEFAULT_SIMULATIONS, horizon=DEFAULT_HORIZON, confidence=DEFAULT_CONFIDENCE, seed=nothing) -> NamedTuple` (`[risk.jl:run_monte_carlo]`): Estima rendimientos y covarianza a partir de precios históricos, simula la cartera, resume resultados y devuelve los parámetros de reproducción.
  - Constantes: `MONTE_CARLO_MODEL` (`"normal-rebalanced-v1"`), `DEFAULT_SIMULATIONS` (`10_000`), `DEFAULT_HORIZON` (`1`), `DEFAULT_CONFIDENCE` (`0.95`), `MAX_SIMULATIONS` (`100_000`), `MAX_HORIZON` (`2_520`) (`[risk.jl:MONTE_CARLO_MODEL]`, `[risk.jl:DEFAULT_SIMULATIONS]`, `[risk.jl:DEFAULT_HORIZON]`, `[risk.jl:DEFAULT_CONFIDENCE]`, `[risk.jl:MAX_SIMULATIONS]`, `[risk.jl:MAX_HORIZON]`).
- **Usuarios (`users.jl`)**:
  - `sync_google_user(users::UserRepository, profile::GoogleProfile) -> AppUser` (`[users.jl:sync_google_user]`): Crea o actualiza un usuario verificado por Google mediante el repositorio configurado.

## Invariants

- `analyze_prices` exige al menos 3 observaciones de precios (`InsufficientDataError`) para que el cálculo de volatilidad disponga de al menos 2 rendimientos simples (`[analysis.jl:analyze_prices]`).
- `run_monte_carlo` exige una serie de precios por cada activo de `portfolio`, igual longitud de observaciones en todas las series (`>= 2` precios), `1 <= simulations <= MAX_SIMULATIONS` (`100_000`), `1 <= horizon <= MAX_HORIZON` (`2_520`) y `0 < confidence < 1`, devolviendo siempre la semilla utilizada y `model = MONTE_CARLO_MODEL` (`[risk.jl:MONTE_CARLO_MODEL]`, `[risk.jl:MAX_SIMULATIONS]`, `[risk.jl:MAX_HORIZON]`, `[risk.jl:run_monte_carlo]`).
- `sync_google_user` delega la persistencia en `save_google_user(users, profile)` y propaga `EmailConflictError` si el correo ya pertenece a otra cuenta (`[users.jl:sync_google_user]`).

## Side Effects

- Si `seed === nothing`, `run_monte_carlo` obtiene una semilla aleatoria `UInt32` desde `Random.RandomDevice()` (`[risk.jl:run_monte_carlo]`).
- `sync_google_user` muta el estado del repositorio de usuarios provisto (`InMemoryUserRepository` o `PostgresUserRepository`) (`[users.jl:sync_google_user]`).

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

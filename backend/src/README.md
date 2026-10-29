# Código fuente (`src`)

## Overview

Responsabilidad: alojar el módulo raíz `MarkovLabBackend.jl` y sus capas `api/`, `domain/`, `services/` e `infrastructure/`.

Contenido permitido: código Julia del paquete, organizado según la responsabilidad de cada capa. Límite: no poner aquí pruebas, credenciales, scripts de despliegue ni migraciones; `MarkovLabBackend.jl` incluye los archivos de cada capa y exporta su interfaz pública.

## Interface

- **Módulo raíz (`MarkovLabBackend.jl`)**:
  - `MarkovLabBackend` (`[MarkovLabBackend.jl:MarkovLabBackend]`):
    - Dominio exportado: `InsufficientDataError`, `simple_returns`, `log_returns`, `cumulative_return`, `mean_return`, `volatility`, `drawdowns`, `max_drawdown`, `correlation`, `correlation_matrix`, `PriceBar`, `Portfolio`, `PORTFOLIO_WEIGHT_TOLERANCE`, `covariance_matrix`, `portfolio_returns`, `portfolio_return`, `portfolio_volatility`, `empirical_quantile`, `value_at_risk`, `conditional_value_at_risk`, `summarize_outcomes`, `simulate_portfolio_returns`, `GoogleProfile`, `AppUser`, `EmailConflictError`, `UserRepository`, `save_google_user` (`[MarkovLabBackend.jl:export]`).
    - Infraestructura y servicios exportados: `ImportIssue`, `PriceImportResult`, `parse_prices_csv`, `read_prices_csv`, `InMemoryUserRepository`, `PostgresUserRepository`, `analyze_prices`, `run_monte_carlo`, `MONTE_CARLO_MODEL`, `MAX_SIMULATIONS`, `MAX_HORIZON`, `sync_google_user` (`[MarkovLabBackend.jl:export]`).
    - Submódulo de transporte HTTP: `MarkovLabBackend.Api` (`[MarkovLabBackend.jl:include("api/Api.jl")]`).
- **Subdirectorios y contratos de capas**:
  - [`api`](./api/README.md): Transporte HTTP/JSON con Oxygen.jl, rutas públicas e internas, validación de solicitudes y CORS.
  - [`domain`](./domain/README.md): Modelos, invariantes y cálculos financieros y de usuarios puros.
  - [`infrastructure`](./infrastructure/README.md): Importación de precios desde CSV y repositorios de usuarios en memoria y PostgreSQL (`LibPQ`).
  - [`services`](./services/README.md): Casos de uso de análisis de precios, simulación Monte Carlo acotada y sincronización de usuarios Google.

## Invariants

- `MarkovLabBackend.jl` carga las capas en orden de dependencia (`domain` -> `infrastructure` -> `services` -> `api`) y mantiene aislada la lógica pura del dominio respecto del transporte HTTP y adaptadores externos (`[MarkovLabBackend.jl:MarkovLabBackend]`).
- Todos los invariantes de validación de datos, pesos de cartera, límites de simulación y unicidad de usuarios documentados en [`./domain/README.md`](./domain/README.md), [`./infrastructure/README.md`](./infrastructure/README.md), [`./services/README.md`](./services/README.md) y [`./api/README.md`](./api/README.md) rigen sobre los símbolos exportados.

## Side Effects

- La invocación de adaptadores de infraestructura, servicios o `MarkovLabBackend.Api.start()` realiza lectura de archivos CSV locales, consultas SQL sobre PostgreSQL (`LibPQ`), lectura de entropía del sistema (`Random.RandomDevice`) o apertura del servidor HTTP (`[MarkovLabBackend.jl:MarkovLabBackend]`).

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

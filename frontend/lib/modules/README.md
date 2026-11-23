# Módulos del Frontend, Adaptadores y Contratos Pendientes (`frontend/lib/modules`)

## Overview
Esta carpeta concentra los contratos de vista, validadores, adaptadores de servidor (`adapters/*.server.ts`) y conjuntos sintéticos deterministas (`fixtures/*.fixture.ts`) para las entregas **F1–F7** definidas en `documentacion/contexto/PLAN_FRONTEND.md`.

## Frecuencias y aislamiento de producción
- `runtime.ts:isLocalFixturesEnabled`: únicamente devuelve `true` cuando `NODE_ENV !== "production"` y `MARKOVLAB_USE_LOCAL_FIXTURES === "1"`.
- Ningún adaptador `*.server.ts` importa `fixtures/*` de manera estática en el nivel superior; todos cargan sus datos sintéticos de forma dinámica dentro de la guardia no productiva y devuelven `status: "not_integrated"` en producción.
- El banco visual de pruebas (`/dev/vistas` y `/dev/vistas/[modulo]`) responde `notFound()` (`404`) en producción o cuando la bandera local está apagada.
- Ningún módulo implementa optimizadores, predictores o backtesters en TypeScript: todos consumen resultados del adaptador y aplican validadores de entrada/consistencia en `validators.ts`.

## Estado de las entregas (según criterio de `PLAN_FRONTEND.md`)

| Entrega | Ruta de producción | Vista local de prueba | Adaptador servidor | Pantalla con datos de prueba | Integrado con API | Publicado |
|---|---|---|---|---|---|---|
| **F1. Análisis de activos** (`RF-15–20`) | `/app/mercado/analisis` | `/dev/vistas/analisis` | `adapters/asset-analysis.server.ts` | Completa | Conectado (`B2`) | Local en rama |
| **F2. Mercado origen/frescura** (`RF-13`) | `/app/mercado` | `/dev/vistas/mercado` | `app/app/mercado/page.tsx` | Completa | Conectado (`RF-12` y `B1`) | Local en rama |
| **F2. Carteras edición/versiones** (`RF-27–33`) | `/app/carteras/[id]/editar` | `/dev/vistas/cartera-editar` | `adapters/portfolio-edit.server.ts` | Completa | Conectado (`B3`) | Local en rama |
| **F3. Escenarios de estrés** (`RF-46`) | `/app/carteras/[id]/estres` | `/dev/vistas/estres` | `adapters/stress.server.ts` | Completa | Conectado (`B4`) | Local en rama |
| **F4. Optimización de carteras** (`RF-34–40`) | `/app/optimizacion` | `/dev/vistas/optimizacion` | `adapters/optimization.server.ts` | Completa | Conectado (`B5`) | Local en rama |
| **F5. Predicción de activos** (`RF-21–26`) | `/app/prediccion` | `/dev/vistas/prediccion` | `adapters/prediction.server.ts` | Completa | Conectado (`B6`) | Local en rama |
| **F6. Backtesting de estrategias** (`RF-49–53`) | `/app/backtesting` | `/dev/vistas/backtesting` | `adapters/backtesting.server.ts` | Completa | Conectado (`B7`) | Local en rama |
| **F7. Dashboard y reportes** (`RF-54–58`) | `/app`, `/app/reportes` | `/dev/vistas/dashboard`, `/dev/vistas/reportes` | `adapters/reports.server.ts` | Completa | `/app` conectado a carteras/mercado/F1–F6; `B8` pendiente | `/app` sí; `/app/reportes` no |

## Estado de contratos Backend (`B1`–`B8`)
- **B1 (`RF-13`, conectado)**: `GET /api/internal/watchlist` expone `latest_price_source` (`"api" | "csv" | "manual" | null`) y `latest_price_status` (`"updated" | "cached" | "local_file" | "unavailable"`).
- **B2 (`RF-15–20`, conectado)**: `POST /api/internal/analysis/assets` con `series_aligned`, `effective_from`, `effective_to`, `aligned_observations`, `per_asset_metrics[]`, `correlation_matrix` y error `422 insufficient_data` (`required_sessions`, `observed_sessions`).
- **B3 (`RF-27–33`, conectado)**: `PUT /api/internal/portfolios/{id}` (con `start_date`), `POST /api/internal/portfolios/{id}/duplicate` (`derived_from_id` sin alterar origen) y `GET /api/internal/portfolios/{id}/versions`.
- **B4 (`RF-46`, conectado)**: `POST /api/internal/portfolios/{id}/stress` reutilizando `horizon`, `confidence` y `seed` con `return_shift`, `volatility_multiplier`, `correlation_shift` y respuesta `baseline` / `stressed` / `deltas`.
- **B5 (`RF-34–40`, conectado)**: `POST` y `GET /api/internal/portfolios/{id}/optimizations` (`min_variance` / `max_sharpe`, cotas por activo, `max_volatility`, `risk_free_rate`, `lookback_years`, historial con insumos y error `422 optimization_infeasible` con `details.reason` y `details.minimum_volatility`).
- **B6 (`RF-21–26`, conectado)**: `POST /api/internal/assets/{id}/predictions` y `GET /api/internal/predictions/{id}` con `model`, `parameters`, `training_window`, `calculated_at`, `as_of`, `limitations[]`, `series[]` (incluyendo `date_estimated`) y `evaluation` opcional con contraste posterior sin reentrenar.
- **B7 (`RF-49–53`, conectado)**: `POST` y `GET /api/internal/portfolios/{id}/backtests` diferenciando `config_from < config_to < eval_from < eval_to`, estrategias `manual`/`min_variance`/`max_sharpe`, `rebalance`, `transaction_cost_bps`, `risk_free_rate`, `benchmark_id` opcional e historial persistido por versión de cartera.
- **B8 (`RF-54–58`)**: `GET /api/internal/reports/summary` y descarga `GET /api/internal/reports/{id}/export?format=csv` controlada por capacidad real `can_export_csv`.

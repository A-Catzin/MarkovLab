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
| **F1. Análisis de activos** (`RF-15–20`) | `/app/mercado/analisis` | `/dev/vistas/analisis` | `adapters/asset-analysis.server.ts` | Completa | Pendiente (`B2`) | No |
| **F2. Mercado origen/frescura** (`RF-13`) | `/app/mercado` | `/dev/vistas/mercado` | `app/app/mercado/page.tsx` | Completa | Parcial (`RF-12` publicado; `B1` pendiente) | Parcial |
| **F2. Carteras edición/versiones** (`RF-27–33`) | `/app/carteras/[id]/editar` | `/dev/vistas/cartera-editar` | `adapters/portfolio-edit.server.ts` | Completa | Pendiente (`B3`) | Alta/detalle sí; edición no |
| **F3. Escenarios de estrés** (`RF-46`) | `/app/carteras/[id]/estres` | `/dev/vistas/estres` | `adapters/stress.server.ts` | Completa | Pendiente (`B4`) | No |
| **F4. Optimización de carteras** (`RF-34–40`) | `/app/optimizacion` | `/dev/vistas/optimizacion` | `adapters/optimization.server.ts` | Completa | Pendiente (`B5`) | No |
| **F5. Predicción de activos** (`RF-21–26`) | `/app/prediccion` | `/dev/vistas/prediccion` | `adapters/prediction.server.ts` | Completa | Pendiente (`B6`) | No |
| **F6. Backtesting de estrategias** (`RF-49–53`) | `/app/backtesting` | `/dev/vistas/backtesting` | `adapters/backtesting.server.ts` | Completa | Pendiente (`B7`) | No |
| **F7. Dashboard y reportes** (`RF-54–58`) | `/app`, `/app/reportes` | `/dev/vistas/dashboard`, `/dev/vistas/reportes` | `adapters/reports.server.ts` | Completa | `/app` conectado a carteras/mercado existentes; `B8` pendiente | `/app` sí; `/app/reportes` no |

## Contratos pendientes por acordar con Backend (`B1`–`B8`)
- **B1 (`RF-13`)**: agregar `price_source?: "api" | "csv" | null`, `data_freshness?: "fresh" | "cached" | "local" | null`, `updated_at?: string | null` en `GET /api/internal/watchlist`.
- **B2 (`RF-15–20`)**: endpoint de análisis histórico multiactivo con `series_aligned`, `effective_from`, `effective_to`, `aligned_observations`, `per_asset_metrics[]`, `correlation_matrix` y error `422 insufficient_data` con conteo requerido vs observado.
- **B3 (`RF-27–33`)**: `PUT / PATCH /api/internal/portfolios/{id}` (con `start_date`), `POST /api/internal/portfolios/{id}/duplicate` (`derivada_de_id` sin alterar origen) y `GET /api/internal/portfolios/{id}/versions`.
- **B4 (`RF-46`)**: `POST /api/internal/portfolios/{id}/stress` reutilizando `horizon`, `confidence` y `seed` con `{ return_shift, volatility_multiplier, correlation_shift }` y respuesta `baseline` / `stressed` / `deltas`.
- **B5 (`RF-34–40`)**: `POST /api/internal/portfolios/optimize` (`min_variance` / `max_sharpe`, límites por activo y `max_volatility?`) devolviendo `422 infeasible_constraints` con lista `conflicts[]`.
- **B6 (`RF-21–26`)**: `POST / GET /api/internal/forecasts` con `model_name`, `model_params`, `training_window`, `calculated_at`, `limitations[]`, banda de incertidumbre y contraste observado opcional.
- **B7 (`RF-49–53`)**: `POST / GET /api/internal/backtests` diferenciando `config_from..config_to` y `eval_from..eval_to` (error `400 overlapping_windows`), benchmark opcional, métricas fuera de muestra e historial persistido.
- **B8 (`RF-54–58`)**: `GET /api/internal/reports/summary` y descarga `GET /api/internal/reports/{id}/export?format=csv` controlada por capacidad real `can_export_csv`.

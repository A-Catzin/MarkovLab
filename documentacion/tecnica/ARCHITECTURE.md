# Arquitectura y responsabilidades de MarkovLab

Este documento es la referencia de la estructura del proyecto. `README.md` introduce el proyecto; [`SRS.md`](../contexto/SRS.md) define los requisitos. La estructura aquí descrita distingue lo ya implementado de lo previsto.

## Límites y flujo actual

| Área | Responsabilidad | Límite |
|---|---|---|
| `frontend/` (implementado) | Interfaz Next.js 15 / TypeScript, portada pública con simulador en navegador, OAuth con Google (`Auth.js`), espacio `/app/*` y panel `/admin/*`. | Nunca consulta directamente PostgreSQL ni expone `INTERNAL_API_KEY`; consume el backend desde rutas y acciones de servidor (`lib/backend.ts`). |
| `backend/` (implementado) | Paquete Julia 1.12.7 (`MarkovLabBackend`) con dominio financiero, servicios, adaptadores CSV/Apify/PostgreSQL, precompilación y API HTTP (`Oxygen.jl`, 17 rutas). | No contiene interfaz visual ni migraciones SQL. |
| `database/` (implementado) | PostgreSQL administrado por Supabase: esquema base y migraciones `0002`–`0004` (9 tablas con RLS activado). | El acceso de negocio ocurre exclusivamente mediante el backend Julia. |
| `documentacion/` | Contexto (`SRS.md`), datos (`diccionario-datos.md`) y guías técnicas. | No sustituye código ni contratos desplegados. |

Flujo en operación:

```text
Navegador → Frontend Next.js (Vercel / Auth.js)
          → Solicitud HTTP/JSON con X-Internal-Key y X-Actor-Id (lib/backend.ts)
          → API Julia con Oxygen.jl (Railway / Docker, src/api/)
          → Servicios (src/services/) → Dominio puro (src/domain/)
          → Infraestructura (CSV, Apify o PostgreSQL vía LibPQ.jl)
          → Respuesta JSON → Visualización en SVG/HTML
```

Lo previsto en el SRS que aún permanece pendiente de implementar incluye: optimización matemática de carteras (`JuMP`/`HiGHS`), modelos predictivos, backtesting y escenarios de estrés.

## Ramas y estabilidad

`main` concentra el trabajo integrado y comprobado. Las ramas de trabajo anteriores (`feature/backend`, `feature/frontend-dashboard`, `feature/db-migrations`, `docs/manual-csv-datasets`) aíslan cambios por área antes de integrarse a `main`.

## Árbol actual del código

```text
.
├── backend/
│   ├── Dockerfile                   # Imagen julia:1.12.7 con precompilación y serve.jl
│   ├── Project.toml / Manifest.toml # Dependencias: Dates, HTTP, JSON, LibPQ, Oxygen, Random
│   ├── README.md / CHANGELOG.md     # Contrato del paquete e historial de cambios
│   ├── config/README.md             # Variables de entorno (HOST, PORT, ALLOWED_ORIGINS, DATABASE_URL, INTERNAL_API_KEY, APIFY_TOKEN)
│   ├── scripts/
│   │   ├── serve.jl                 # Arranque HTTP de MarkovLabBackend.Api
│   │   ├── import_prices.jl         # Carga de precios desde CSV a PostgreSQL
│   │   └── sync_prices.jl           # Descarga de precios y divisas desde Apify (Yahoo Finance)
│   ├── src/
│   │   ├── MarkovLabBackend.jl      # Módulo raíz, exportaciones e inclusión de precompile.jl
│   │   ├── precompile.jl            # Carga de trabajo de precompilación en memoria (para Docker)
│   │   ├── api/                     # Api.jl (warm_database, configure!, start), routes.jl (17 rutas), errors.jl, cors.jl
│   │   ├── domain/                  # assets, errors, exchange_rates, market_data, metrics, portfolio, portfolio_history, prices, saved_portfolios, saved_simulations, simulation, users
│   │   ├── services/                # admin, analysis, market_sync, portfolio_simulations, portfolios, prices, risk, users
│   │   └── infrastructure/          # csv_prices, apify_market_data, postgres.jl, memory_* y postgres_{users,prices,portfolios,simulations}
│   └── test/                        # Suites por capa (domain, services, api, infrastructure) y fixtures/
├── database/
│   └── migrations/                  # esquema.sql (0001), 0002_cierre_ajustado.sql, 0003_roles.sql, 0004_tipos_cambio.sql
└── frontend/
    ├── app/                         # layout.tsx, globals.css, experience.css, /, /login, /api/auth/*, /app/*, /admin/*
    ├── components/                  # auth/, brand/, landing/, app/
    ├── lib/                         # admin.ts, auth.ts, backend.ts, demo.ts, guards.ts, landing-data.ts, portfolios.ts, simulation.ts
    └── types/                       # next-auth.d.ts
```

Para el detalle de cada área, consulte [`API.md`](API.md), [`AUTENTICACION.md`](AUTENTICACION.md), [`ROLES.md`](ROLES.md), [`CARTERAS.md`](CARTERAS.md), [`PRECIOS_API.md`](PRECIOS_API.md), [`LANDING.md`](LANDING.md) y [`DESPLIEGUE.md`](DESPLIEGUE.md).

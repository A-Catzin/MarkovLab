# Utilidades del frontend (`frontend/lib`)

## Overview
Lógica compartida que da soporte a la interfaz (`frontend/lib`). Incluye el cliente HTTP del servidor hacia la API Julia (`backend.ts`), la configuración de Auth.js con actualización periódica de rol (`auth.ts`), guardas de navegación (`guards.ts`), clientes tipados para carteras y administración (`portfolios.ts`, `admin.ts`), la réplica en navegador del modelo Monte Carlo (`simulation.ts`, `demo.ts`) y los datos estáticos de la portada (`landing-data.ts`).

Ver [`LANDING.md`](../../documentacion/tecnica/LANDING.md), [`AUTENTICACION.md`](../../documentacion/tecnica/AUTENTICACION.md), [`ROLES.md`](../../documentacion/tecnica/ROLES.md), [`CARTERAS.md`](../../documentacion/tecnica/CARTERAS.md) y [`API.md`](../../documentacion/tecnica/API.md).

## Interface
- **Cliente HTTP del backend (`backend.ts`)**:
  - `Role` (`"user" | "admin"`), `BackendUser`, `BackendError`, `BACKEND_TIMEOUT_MS` (`10_000`), `backendFetch<T>(path, { method, body, actorId })` (`[backend.ts:BackendError]`, `[backend.ts:backendFetch]`).
- **Autenticación y sesión (`auth.ts`, `guards.ts`)**:
  - `[auth.ts:authOptions]`, `[auth.ts:ROLE_REFRESH_MS]` (`60_000`), `[auth.ts:syncUser]`, `[auth.ts:currentRole]`, `[auth.ts:getSession]` (envuelto en `React.cache`).
  - `[guards.ts:requireUser]`: Exige sesión activa (`getSession()`) o redirige a `/login`.
  - `[guards.ts:requireAdmin]`: Exige `user.role === "admin"` o redirige a `/app`.
- **Carteras y simulaciones (`portfolios.ts`)**:
  - Tipos: `CatalogAsset`, `PortfolioPosition`, `Portfolio`, `PortfolioHistory`, `Simulation`, `STATUS_LABELS`.
  - Consultas y formato: `getCatalogAssets`, `getPortfolios`, `getPortfolio`, `getPortfolioHistory`, `getSimulations`, `currencyNote`, `formatMoney`, `formatWeight` (`[portfolios.ts:getPortfolios]`, `[portfolios.ts:getPortfolioHistory]`, `[portfolios.ts:getSimulations]`, `[portfolios.ts:currencyNote]`).
- **Administración (`admin.ts`)**:
  - Tipos: `ImportStatus`, `AdminSummary`, `AdminAsset`, `AdminImport`, `IMPORT_STATUS_LABELS`.
  - Consultas y formato: `getAdminSummary`, `getAdminAssets`, `getAdminImports`, `getAdminUsers`, `loadAdmin`, `formatDateTime`, `formatDate`, `formatNumber` (`[admin.ts:getAdminSummary]`, `[admin.ts:loadAdmin]`).
- **Simulador de portada y demo (`simulation.ts`, `demo.ts`, `landing-data.ts`)**:
  - `[demo.ts:DemoResult]`, `[demo.ts:runDemo]`.
  - `[landing-data.ts:SAMPLE_ASSETS]`, `[landing-data.ts:SAMPLE_CORRELATION]`, `[landing-data.ts:DEFAULT_REQUEST]`, `[landing-data.ts:DEFAULT_CAPITAL]`, `[landing-data.ts:HORIZON_OPTIONS]`, `[landing-data.ts:NAV_LINKS]`, `[landing-data.ts:FACTS]`, `[landing-data.ts:REQUEST_STAGES]`, `[landing-data.ts:IMPLEMENTED_METRICS]`, `[landing-data.ts:QUESTIONS]`, `[landing-data.ts:REPOSITORY_URL]`.
  - `[simulation.ts:TRADING_DAYS]` (`252`), `[simulation.ts:SUMMARY_PERCENTILES]`, `SampleAsset`, `SimulationSummary`, `SimulationRequest`, `mulberry32`, `normalGenerator`, `portfolioMoments`, `simulateOutcomes`, `quantileSorted`, `summarize`, `histogram`, `runSimulation`, `samplePaths` (`[simulation.ts:runSimulation]`, `[simulation.ts:samplePaths]`).

## Invariants
- `[backend.ts:server-only]`, `[auth.ts:server-only]`, `[guards.ts:server-only]`, `[admin.ts:server-only]`, `[portfolios.ts:server-only]`: Importan `"server-only"` y no pueden importarse desde Client Components.
- `[backend.ts:BACKEND_TIMEOUT_MS]`: Cada llamada a la API Julia fija `AbortSignal.timeout(10_000)` y desactiva caché (`cache: "no-store"`), enviando `X-Internal-Key` y opcionalmente `X-Actor-Id`.
- `[auth.ts:signIn]`: Solo abre sesión cuando `account?.provider === "google"`, el correo está verificado (`email_verified === true`) y `syncUser` confirma el guardado en PostgreSQL (`POST /api/internal/users/google`).
- `[auth.ts:jwt]`: Tras `ROLE_REFRESH_MS` (`60_000` ms), consulta `GET /api/internal/users/{id}` (`currentRole`); si el backend devuelve `404`, elimina `token.userId` y `token.role` para invalidar la sesión.
- `[simulation.ts:portfolioMoments]`, `[simulation.ts:quantileSorted]`, `[simulation.ts:summarize]`, `[simulation.ts:runSimulation]`: Replican en navegador el modelo `normal-rebalanced-v1` (252 días hábiles, cuantiles tipo 7 de Hyndman-Fan, VaR/CVaR positivos y 36 intervalos de histograma).

## Side Effects
- `[backend.ts:backendFetch]`: Lee `process.env.BACKEND_URL` e `process.env.INTERNAL_API_KEY` y realiza solicitudes HTTP sin caché al backend Julia.
- `[auth.ts:authOptions]`: Lee `process.env.GOOGLE_CLIENT_ID` y `process.env.GOOGLE_CLIENT_SECRET`, sincroniza usuarios en el backend y muta `user`, `token` y `session` en callbacks de Auth.js.
- `[guards.ts:requireUser]` / `[guards.ts:requireAdmin]`: Emite redirecciones Next.js (`redirect("/login")` o `redirect("/app")`) cuando falta sesión o permisos.

## Verification
- Run: `npm run typecheck && npm run build`

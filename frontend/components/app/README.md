# Componentes de aplicación y administración (`frontend/components/app`)

## Overview
Componentes reutilizables de la interfaz autenticada (`/app/*`) y del panel de administración (`/admin/*`): marco de navegación (`AppShell`, `NavLinks`), avisos de error (`AdminError`), formularios de alta/edición e importación (`PortfolioForm`, `PortfolioVersionsPanel`, `ImportForm`), visualizaciones de cartera (`PortfolioHistoryChart`, `PortfolioSimulation`) y pantallas modulares F1–F7 (`AssetAnalysisView`, `MarketOriginPreview`, `StressTestingView`, `OptimizationView`, `PredictionView`, `BacktestingView`, `DashboardOverview`, `ReportsView`, `ModuleStateViews`).

## Interface
- `[AppShell.tsx:AppShell]`: Marco principal con `Wordmark`, enlaces configurables (`navItems` o `USER_NAV` + `PREVIEW_APP_NAV` únicamente cuando `showPreviewNav` es verdadero en entorno local), grupo de administración condicional (`ADMIN_NAV` cuando `user.role === "admin"`), correo y salida.
- `[NavLinks.tsx:NavLinks]` & `NavItem`: Client component que resalta la ruta activa mediante `usePathname()` con `aria-current="page"`.
- `[AdminError.tsx:AdminError]`: Banner accesible (`role="alert"`) para fallos de carga en páginas de administración.
- `[ImportForm.tsx:ImportForm]`: Client component conectado a `importCsv` (`useActionState`) para subir archivos CSV de un activo.
- `[PortfolioForm.tsx:PortfolioForm]`: Client component reutilizable en creación (`mode="create"` conectado a `createPortfolio`) y edición (`mode="edit"` con fecha de referencia, validación enfocable y aviso explícito de pendiente `B3`).
- `[PortfolioVersionsPanel.tsx:PortfolioVersionsPanel]`: Historial de versiones con rendimiento/riesgo estimado y `<dialog>` nativo accesible para validar duplicación sin alterar el original (`RF-33`).
- `[PortfolioHistoryChart.tsx:PortfolioHistoryChart]` & `HistoryPoint`: Gráfica SVG interactiva de valor histórico con exploración por teclado y tabla mensual.
- `[PortfolioSimulation.tsx:PortfolioSimulation]`: Simulación Monte Carlo persistida existente.
- `[ModuleStateViews.tsx]`: `ExampleDataBanner`, `ProvenanceStrip`, `ModuleStatePanel`, `LoadingSkeletonPanel`, `ErrorSummary` y `ScenarioBar`.
- `[AssetAnalysisView.tsx]`, `[MarketOriginPreview.tsx]`, `[StressTestingView.tsx]`, `[OptimizationView.tsx]`, `[PredictionView.tsx]`, `[BacktestingView.tsx]`, `[DashboardOverview.tsx]`, `[ReportsView.tsx]`: Vistas clientes encapsuladas con estilos propios en `[modules.module.css]`.

## Invariants
- `[AppShell.tsx:AppShell]`: En producción (`showPreviewNav=false`), muestra únicamente `USER_NAV` y bloque `ADMIN_NAV` para administradores; la protección real permanece en los layouts y el backend.
- `[NavLinks.tsx:NavLinks]`: Las raíces `/app` y `/admin` solo reciben `aria-current="page"` en coincidencia exacta de `pathname`.
- `[PortfolioForm.tsx:PortfolioForm]`: Preserva intacto el envío `createPortfolio` cuando `mode="create"`, exige suma de pesos cercana al `100 %` (`Math.abs(total - 100) < 0.005`), impide repetir activos y limita filas a `MAX_ROWS` (`50`).
- `[ReportsView.tsx]`: Deshabilita la exportación CSV hasta contar con capacidad real de backend (`csvAvailable=true`); nunca emite descargas sintéticas.

## Verification
- Run: `npm run typecheck && npm run lint && npm test && npm run build`

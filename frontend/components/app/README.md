# Componentes de aplicación y administración (`frontend/components/app`)

## Overview
Componentes reutilizables de la interfaz autenticada (`/app/*`) y del panel de administración (`/admin/*`): marco de navegación (`AppShell`, `NavLinks`), avisos de error (`AdminError`), formularios de alta e importación (`PortfolioForm`, `ImportForm`) y visualizaciones de cartera (`PortfolioHistoryChart`, `PortfolioSimulation`).

## Interface
- `[AppShell.tsx:AppShell]`: Marco principal con `Wordmark` (`/app`), enlaces de usuario (`USER_NAV`), grupo de administración condicional (`ADMIN_NAV` cuando `user.role === "admin"`), correo y `SignOutButton`.
- `[NavLinks.tsx:NavLinks]` & `NavItem`: Client component que resalta la ruta activa mediante `usePathname()` con `aria-current="page"`.
- `[AdminError.tsx:AdminError]`: Banner accesible (`role="alert"`) para fallos de carga en páginas de administración.
- `[ImportForm.tsx:ImportForm]`: Client component conectado a `importCsv` (`useActionState`) para subir archivos CSV de un activo y mostrar el resumen de filas guardadas, ya guardadas e inválidas.
- `[PortfolioForm.tsx:PortfolioForm]`: Client component conectado a `createPortfolio` (`useActionState`) con cálculo de suma en vivo (`totalOk`), reparto equitativo (`splitEvenly`) y límite de filas (`MAX_ROWS = 50`).
- `[PortfolioHistoryChart.tsx:PortfolioHistoryChart]` & `HistoryPoint`: Client component con gráfica SVG interactiva (rangos `1A`, `5A`, `10A`, `Todo`), línea de ancla (`anchorDate`), referencia de capital, exploración por puntero/teclado y tabla mensual accesible.
- `[PortfolioSimulation.tsx:PortfolioSimulation]`: Client component conectado a `simulatePortfolio` (`useActionState`) que ejecuta simulaciones Monte Carlo persistidas y muestra la corrida más reciente junto al historial de simulaciones anteriores.

## Invariants
- `[AppShell.tsx:AppShell]`: Solo muestra los enlaces `ADMIN_NAV` si `user.role === "admin"`, manteniendo la validación real en los layouts y el backend.
- `[NavLinks.tsx:NavLinks]`: Las raíces `/app` y `/admin` solo reciben `aria-current="page"` en coincidencia exacta de `pathname`.
- `[PortfolioForm.tsx:PortfolioForm]`: Exige suma de pesos cercana al `100 %` (`Math.abs(total - 100) < 0.005`), impide repetir un mismo activo en dos filas y limita el formulario a `MAX_ROWS` (`50`) posiciones.
- `[PortfolioHistoryChart.tsx:PortfolioHistoryChart]`: Muestrea un máximo de `MAX_DRAWN` (`600`) puntos en la polilínea SVG y mide el ancho real del contenedor con `ResizeObserver` para conservar la legibilidad de etiquetas.

## Side Effects
- `[ImportForm.tsx:ImportForm]`, `[PortfolioForm.tsx:PortfolioForm]`, `[PortfolioSimulation.tsx:PortfolioSimulation]`: Invocan Server Actions (`importCsv`, `createPortfolio`, `simulatePortfolio`) con estado gestionado por `useActionState`.
- `[PortfolioHistoryChart.tsx:PortfolioHistoryChart]`: Registra un `ResizeObserver` sobre el contenedor SVG y escucha eventos de puntero y teclado (`ArrowLeft`/`ArrowRight`) para actualizar el punto inspeccionado.

## Verification
- Run: `npm run typecheck && npm run build`

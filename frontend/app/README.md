# Aplicación

Páginas, navegación y estructura de la aplicación frontend (Next.js App Router).

## Contenido actual

- `layout.tsx`: idioma, tipografías (Young Serif y Source Serif 4 con `next/font`) y la clase `js` que activa las animaciones.
- `page.tsx`: página de inicio; compone las secciones de [`components/landing/`](../components/landing/).
- `login/page.tsx`: acceso provisional, sin autenticación; el botón lleva a `/app`.
- `app/layout.tsx`: shell de la aplicación (navegación, cuenta y contenido).
- `app/page.tsx`: inicio de la aplicación con resumen y módulos.
- `app/simulador/page.tsx`: simulador de riesgo dentro de la aplicación con soporte para recibir parámetros de carteras.
- `app/carteras/page.tsx`: módulo completo de carteras (creación, edición, pesos con validación al 100 %, métricas de rendimiento y riesgo, historial de versiones y duplicados).
- `app/optimizacion/page.tsx`: módulo completo de optimización (mínima varianza, máximo Sharpe, restricciones por activo, comparación antes/después y frontera eficiente).
- `app/backtesting/page.tsx`: módulo de backtesting (período histórico, rebalanceo, benchmark SPY/BND, métricas comparadas, gráfico de evolución, guardado del resultado y exportación CSV).
- `app/historial/`: pantalla de módulo en diseño.
- `globals.css`: tokens de color, tipo y espacio, estilos de cada sección, shell de la aplicación y movimiento con alternativa para `prefers-reduced-motion`.

Diseño documentado en [`LANDING.md`](../../documentacion/tecnica/LANDING.md). Los cálculos financieros y la persistencia pertenecen al backend Julia.

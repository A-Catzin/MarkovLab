# Utilidades del frontend

Lógica compartida que da soporte a la interfaz.

## Contenido actual

- `simulation.ts`: versión para el navegador del modelo Monte Carlo del backend (`normal-rebalanced-v1`), con cuantiles, VaR, CVaR, histograma y trayectorias.
- `demo.ts`: ejecuta la cartera de demostración; lo usan el servidor (primer render) y el simulador.
- `landing-data.ts`: textos y datos de ejemplo de la página de inicio, incluidas las mediciones del motor Julia.

Ver [`LANDING.md`](../../documentacion/tecnica/LANDING.md). Todavía no hay cliente HTTP para la API Julia; su contrato está en [`API.md`](../../documentacion/tecnica/API.md).

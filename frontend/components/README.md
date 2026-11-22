# Componentes

Elementos de interfaz de MarkovLab. Las rutas y la composición de páginas pertenecen a [`app/`](../app/); los datos, el modelo de simulación del navegador y las utilidades, a [`lib/`](../lib/). Este directorio no reemplaza los cálculos del backend.

## Contenido actual

`landing/` contiene las secciones de la página de inicio: `Hero`, `Intro`, `Simulator`, `Modules`, `Pipeline`, `Questions`, `SiteFooter` y `RevealOnScroll`. Su diseño y comportamiento están documentados en [`LANDING.md`](../../documentacion/tecnica/LANDING.md).

`Simulator` y `RevealOnScroll` son componentes de cliente; los demás se renderizan en el servidor.

`brand/Wordmark.tsx` es el logotipo de texto ("Markov" + "Lab" en acento) que usan `/login` y `/app`.

`app/AppShell.tsx` es el shell de la aplicación: navegación con estado activo, cuenta provisional, enlace para saltar al contenido y reactivación de las entradas al cambiar de ruta.

`app/carteras/` contiene los componentes del módulo de gestión de carteras:
- `CarterasManager.tsx`: orquestador de estado, sincronización con `localStorage`, vistas y notificaciones.
- `PortfolioCard.tsx`: tarjeta de cartera con métricas rápidas, composición en miniatura y acciones.
- `PortfolioDetail.tsx`: vista detallada con desglose porcentual, tabla de activos, efecto de diversificación e historial de versiones.
- `PortfolioForm.tsx`: editor interactivo de carteras con barras de asignación, validación de 100 %, normalizador automático y estimación en tiempo real.

`app/optimizacion/` contiene los componentes del módulo de optimización:
- `OptimizationManager.tsx`: coordinador del flujo de optimización, sincronización y acciones de guardado/simulación.
- `OptimizationSetup.tsx`: selector de cartera base, objetivos (mínima varianza / máximo Sharpe) y controles de restricciones de peso.
- `OptimizationComparison.tsx`: comparativa lado a lado (cartera manual vs. optimizada), deltas métricos y tabla de rebalanceo.
- `EfficientFrontierChart.tsx`: gráfico vectorial de la Frontera Eficiente de Markowitz con puntos destacados.

`app/backtesting/` contiene los componentes del módulo de backtesting:
- `BacktestManager.tsx`: orquestador del flujo (cartera, período, rebalanceo, benchmark), ejecución y guardado del resultado en `localStorage`.
- `BacktestSetup.tsx`: panel de configuración con cartera, período histórico, frecuencia de rebalanceo, benchmark y capital inicial.
- `BacktestResults.tsx`: resumen, tarjetas y tabla de métricas comparadas (rendimiento, CAGR, volatilidad, Sharpe, drawdown, beta y alfa), acciones de guardado, simulación y descarga CSV.
- `BacktestPerformanceChart.tsx`: gráfico SVG de la evolución del patrimonio de la cartera contra el benchmark.

`app/historial/HistorialManager.tsx` reúne las simulaciones, los backtesting y las carteras guardadas en `localStorage`, con repetición de simulaciones y eliminación de registros.

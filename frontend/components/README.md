# Componentes

Elementos de interfaz de MarkovLab. Las rutas y la composición de páginas pertenecen a [`app/`](../app/); los datos, el modelo de simulación del navegador y las utilidades, a [`lib/`](../lib/). Este directorio no reemplaza los cálculos del backend.

## Contenido actual

`landing/` contiene las secciones de la página de inicio: `Hero`, `Intro`, `Simulator`, `Modules`, `Pipeline`, `Questions`, `SiteFooter` y `RevealOnScroll`. Su diseño y comportamiento están documentados en [`LANDING.md`](../../documentacion/tecnica/LANDING.md).

`Simulator` y `RevealOnScroll` son componentes de cliente; los demás se renderizan en el servidor.

`brand/Wordmark.tsx` es el logotipo de texto ("Markov" + "Lab" en acento) que usan `/login` y `/app`.

`app/AppShell.tsx` es el shell de la aplicación: navegación con estado activo, cuenta provisional, enlace para saltar al contenido y reactivación de las entradas al cambiar de ruta. `app/ModulePlaceholder.tsx` es la pantalla común de los módulos que todavía están en diseño.

`app/carteras/` contiene los componentes del módulo de gestión de carteras:
- `CarterasManager.tsx`: orquestador de estado, sincronización con `localStorage`, vistas y notificaciones.
- `PortfolioCard.tsx`: tarjeta de cartera con métricas rápidas, composición en miniatura y acciones.
- `PortfolioDetail.tsx`: vista detallada con desglose porcentual, tabla de activos, efecto de diversificación e historial de versiones.
- `PortfolioForm.tsx`: editor interactivo de carteras con barras de asignación, validación de 100 %, normalizador automático y estimación en tiempo real.

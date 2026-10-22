# Componentes

Elementos de interfaz de MarkovLab. Las rutas y la composición de páginas pertenecen a [`app/`](../app/); los datos, el modelo de simulación del navegador y las utilidades, a [`lib/`](../lib/). Este directorio no reemplaza los cálculos del backend.

## Contenido actual

`landing/` contiene las secciones de la página de inicio: `Hero`, `Intro`, `Simulator`, `Modules`, `Pipeline`, `Questions`, `SiteFooter` y `RevealOnScroll`. Su diseño y comportamiento están documentados en [`LANDING.md`](../../documentacion/tecnica/LANDING.md).

`Simulator` y `RevealOnScroll` son componentes de cliente; los demás se renderizan en el servidor.

`brand/Wordmark.tsx` es el logotipo de texto ("Markov" + "Lab" en acento) que usan `/login` y `/app`.

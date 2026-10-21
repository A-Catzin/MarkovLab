# Aplicación

Páginas, navegación y estructura de la aplicación frontend (Next.js App Router).

## Contenido actual

- `layout.tsx`: idioma, tipografías (Young Serif y Source Serif 4 con `next/font`) y la clase `js` que activa las animaciones.
- `page.tsx`: página de inicio; compone las secciones de [`components/landing/`](../components/landing/).
- `globals.css`: tokens de color, tipo y espacio, estilos de cada sección y movimiento con alternativa para `prefers-reduced-motion`.

Diseño documentado en [`LANDING.md`](../../documentacion/tecnica/LANDING.md). Los cálculos financieros y la persistencia pertenecen al backend Julia.

# Frontend de MarkovLab

Este directorio reserva la interfaz de usuario de MarkovLab: presentación de datos, interacción con carteras y visualización de resultados. El frontend previsto usará Next.js y TypeScript y se comunicará con el backend Julia mediante HTTP/JSON; los cálculos y la persistencia pertenecen al backend.

## Navegación rápida

| Directorio | Responsabilidad prevista |
| --- | --- |
| [`app/`](./app/) | Páginas, navegación y estructura de la aplicación. |
| [`components/`](./components/) | Elementos reutilizables de interfaz. |
| [`lib/`](./lib/) | Utilidades y acceso a la API desde el frontend. |
| [`public/`](./public/) | Recursos estáticos públicos. |

## Alcance actual

Configuración de **Next.js (App Router)**, **TypeScript** y **Tailwind CSS**, con la página de inicio rediseñada como un informe científico sobre fondo oscuro. Incluye un simulador Monte Carlo que corre en el navegador con el mismo modelo que el backend. Diseño, secciones, datos de ejemplo e imágenes en [`LANDING.md`](../documentacion/tecnica/LANDING.md).

### Comandos principales

```bash
cd frontend
npm install
npm run dev        # Servidor de desarrollo local
npm run typecheck  # Verificación estática de tipos TypeScript
npm run build      # Compilación de producción
```

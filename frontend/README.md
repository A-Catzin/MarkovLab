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

La rama `feature/frontend-dashboard` agrupa el trabajo de la interfaz sin alterar la rama principal. Por ahora solo existe esta estructura documental: no hay proyecto Next.js configurado, dependencias, rutas, componentes, cliente HTTP ni código ejecutable. Las decisiones de implementación y los contratos concretos de la API se definirán antes de conectar la interfaz.

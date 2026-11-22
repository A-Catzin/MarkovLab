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

Configuración de **Next.js (App Router)**, **TypeScript** y **Tailwind CSS**, con la página de inicio rediseñada como un informe científico sobre fondo oscuro. Incluye un simulador Monte Carlo que corre en el navegador con el mismo modelo que el backend, y la aplicación en `/app` con los módulos de carteras, optimización y backtesting (datos de ejemplo y persistencia provisional en `localStorage`). Diseño, secciones, datos de ejemplo e imágenes en [`LANDING.md`](../documentacion/tecnica/LANDING.md).

### Rutas

| Ruta | Archivo | Qué es |
| --- | --- | --- |
| `/` | `app/page.tsx` | Landing de presentación con el simulador. |
| `/login` | `app/login/page.tsx` | Acceso provisional: un botón "Entrar a MarkovLab" que lleva a `/app`. Todavía no hay autenticación. |
| `/app` | `app/app/page.tsx` | Inicio de la aplicación: resumen y lista de módulos. |
| `/app/simulador` | `app/app/simulador/page.tsx` | Simulador de riesgo dentro de la aplicación. |
| `/app/carteras` | `app/app/carteras/page.tsx` | Gestión de carteras: creación, activos y pesos con validación del 100 %, rendimiento y riesgo estimado, historial de versiones (RF-32), duplicación (RF-33) y acceso directo al simulador. |
| `/app/optimizacion` | `app/app/optimizacion/page.tsx` | Optimización de carteras (Markowitz): mínima varianza, máximo ratio de Sharpe (RF-34, RF-35), restricciones por activo (RF-36), factibilidad (RF-39), comparativa lado a lado (RF-40) y frontera eficiente. |
| `/app/backtesting` | `app/app/backtesting/page.tsx` | Backtesting de una cartera guardada (RF-49–53): período de 1/3/5 años, rebalanceo, benchmark SPY o BND, métricas comparadas, gráfico de evolución, guardado del resultado y CSV. |
| `/app/historial` | `app/app/historial/page.tsx` | Módulo de historial en diseño. |

El layout `app/app/layout.tsx` aporta el shell común: wordmark, navegación con estado activo, enlace para saltar al contenido y cuenta provisional.

**Acceso provisional:** por decisión del equipo, `/login` no autentica; el botón solo redirige a `/app` para avanzar con la aplicación. El siguiente paso es integrar el inicio de sesión con Google; cuando exista, `/app` deberá protegerse y "Salir" deberá cerrar la sesión.

### Comandos principales

```bash
cd frontend
npm install
npm run dev        # Servidor de desarrollo local
npm run typecheck  # Verificación estática de tipos TypeScript
npm run build      # Compilación de producción
```

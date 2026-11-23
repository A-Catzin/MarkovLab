# Plan de implementación del frontend

Construir las pantallas pendientes del [SRS](SRS.md) en paralelo al [backend](PLAN_BACKEND.md). Cada módulo puede tener un flujo navegable con datos de prueba antes de tener API. Una pantalla demostrable no se considera integrada ni disponible en producción.

## Primer encargo para el agente de frontend

1. Leer el SRS y verificar las rutas actuales. Reutilizar el marco autenticado de `/app`, la navegación, los formularios, los estados y los componentes visuales existentes. No sustituir Mercado, Mis carteras ni el Simulador.
2. Empezar por el análisis de activos. Entregar una página con selección de activos y período, métricas, matriz de correlación y estado de datos insuficientes; probarla con un conjunto de datos sintéticos determinista.
3. Continuar por las siguientes pantallas del inventario sin esperar a B3–B8. Mantener los contratos provisionales separados del código de producción. Al entregar cada módulo, indicar su estado y los campos que faltan acordar con backend.

RF-12 ya tiene interfaz en el commit local `ee53155`. No duplicar el botón ni habilitarlo en producción: el control depende de la capacidad anunciada por la API. El historial de simulaciones ya existe dentro del detalle de cada cartera; una vista global sería una mejora, no un requisito de persistencia pendiente.

## Pantallas y estados por módulo

| Entrega | Ruta propuesta o existente | Primera versión con datos de prueba |
|---|---|---|
| **F1. Análisis de activos** · RF-15–20 | Nueva: `/app/mercado/analisis` | Selector de activos y período, rendimientos y riesgo, matriz de correlación, fechas efectivas y caso de histórico insuficiente. |
| **F2. Mercado y carteras** · RF-13, RF-27–33 | Existentes: `/app/mercado`, `/app/carteras/[id]`; nueva: `/app/carteras/[id]/editar` | Etiqueta de origen/fecha en Mercado. En carteras, formulario de edición reutilizado, lista de versiones y diálogo de duplicación. Mostrar suma de pesos, errores de validación y guardado pendiente del backend. |
| **F3. Estrés** · RF-46 | Nueva: `/app/carteras/[id]/estres` | Controles de escenario y comparación base/estrés con el mismo horizonte y nivel de confianza. Mostrar restricciones inválidas y ausencia de resultados. No tocar la simulación actual. |
| **F4. Optimización** · RF-34–40 | Nueva: `/app/optimizacion` | Selector de objetivo, límites por activo y riesgo máximo opcional. Comparar pesos manuales y optimizados, explicar una solución inviable y no mostrar resultados como recomendaciones. |
| **F5. Predicción** · RF-21–26 | Nueva: `/app/prediccion` | Selector de activo y horizonte, curva con incertidumbre, modelo, fechas, limitaciones y comparación con datos observados cuando existan. No dar una predicción de ejemplo por válida. |
| **F6. Backtesting** · RF-49–53 | Nueva: `/app/backtesting` | Parámetros de estrategia, período de evaluación, benchmark opcional, gráfico, métricas e historial. Diferenciar visualmente el período de configuración del período de evaluación. |
| **F7. Dashboard y reportes** · RF-54–58 | Existente: `/app`; nueva: `/app/reportes` | Resumen de análisis con fecha, período y fuente, explicación de métricas y estados de exportación. No ofrecer descargas simuladas como reportes del usuario. |

Las rutas nuevas son propuestas de navegación, no contratos HTTP. RF-14 (alertas visuales) queda como extra del SRS. La primera ronda cubre pantallas y estados; cada módulo se conecta cuando su operación real esté disponible.

## Cómo trabajar sin API

- Definir los tipos de vista por módulo y dejar el acceso a datos detrás de un adaptador. Los datos sintéticos viven en pruebas o en una vista local de desarrollo identificada como **Datos de ejemplo**. No se empaquetan como respaldo de producción ni se muestran si falla la API real.
- Cubrir carga, lista vacía, pocos datos, error de validación, indisponibilidad y acceso denegado. En producción, ocultar o marcar como no disponible un módulo aún no integrado; no simular que una escritura se guardó.
- Reservar los cálculos financieros para Julia. El frontend formatea fracciones, moneda y fechas, muestra cobertura y unidades, y explica los errores. No implementar un segundo optimizador, predictor o motor de backtesting en TypeScript.
- Conectar cada adaptador por el servidor de Next.js cuando el backend entregue el contrato y un ejemplo verificado. Mantener las credenciales y la identidad fuera del navegador.

## Alcance y criterio de entrega

El agente de frontend puede editar `frontend/app/app/`, `frontend/components/app/`, los módulos de datos de `frontend/lib/` y sus pruebas. Coordinar cambios en la navegación compartida; no editar `backend/`, migraciones ni contratos HTTP publicados. No hay que rescatar ni copiar en bloque el PR #9 cerrado.

Por módulo, pasar el chequeo de TypeScript, recorrer el flujo en navegador con teclado y pantalla estrecha, y registrar tres estados distintos: **pantalla con datos de prueba**, **integrado con API**, y **publicado**. El trabajo independiente empieza por F1; en la primera conexión real, verificar una respuesta correcta y una de error con el backend local.

# Plan de implementación del backend

Implementar los módulos pendientes del [SRS](SRS.md) en Julia y PostgreSQL, una entrega verificable a la vez. El [plan de frontend](PLAN_FRONTEND.md) puede avanzar con datos de prueba mientras se definen y verifican los contratos HTTP.

## Punto de partida

- `2953455`: base publicada verificada, con lista de seguimiento, últimos cierres, variaciones e histórico. Ya existen importación CSV/API, motor de métricas, creación de carteras y simulaciones guardadas por cartera.
- `ee53155`: RF-12 implementado y revisado en `main` local al preparar este plan. No publicado ni habilitado en producción. La [guía de activación](../tecnica/ACTUALIZACION_MERCADO.md) describe los controles; queda pendiente el aviso de resiliencia R4-001.
- [API.md](../tecnica/API.md) es la referencia de contratos **implementados**. Los ítems siguientes son pendientes, no endpoints disponibles.

## Orden de trabajo

| Entrega | Requisitos | Implementación y criterio de aceptación |
|---|---|---|
| **B1. Seguimiento de mercado** | RF-12–13 | En un cambio separado de RF-12, aislar los fallos de guardado por trabajo: si uno falla, intentar guardar los demás resultados sin repetir consultas al proveedor. Probar el fallo con un lote de varios símbolos. Luego exponer el origen real del cierre (API o CSV) y distinguir procedencia de vigencia, con una regla explícita para fines de semana, caché y datos ausentes. RF-14 es opcional según el SRS. |
| **B2. Análisis de activos** | RF-15–20 | Reutilizar el motor de métricas y los datos guardados. Recibir activos y fechas, alinear sesiones de rendimientos y devolver métricas, matriz de correlación y cobertura efectiva. Probar calendarios desalineados, series constantes y un período insuficiente. |
| **B3. Carteras editables** | RF-27–33 | Completar fecha configurable donde falte, edición de pesos, versiones y duplicación. Mantener las reglas de moneda y pesos del dominio. Escribir cartera y posiciones de forma atómica; comprobar que otra cuenta no puede editar y que duplicar no cambia el original. |
| **B4. Estrés de cartera** | RF-46 | Reutilizar simulación y semilla. Comparar base y estrés con cambios explícitos en rendimientos, volatilidades o correlaciones. Rechazar parámetros inválidos y comprobar que la cartera original no cambia. |
| **B5. Optimización** | RF-34–40 | Implementar mínima varianza y máximo Sharpe con límites por activo, tope opcional de riesgo y comparación contra la cartera manual. Definir y documentar la frecuencia y la tasa libre de riesgo. Verificar pesos, restricciones inviables y un caso pequeño con solución conocida. Conservar objetivo, restricciones, datos y solución según el SRS. |
| **B6. Predicción** | RF-21–26 | Elegir y documentar un modelo base reproducible antes de ofrecerlo como funcional. Persistir modelo, parámetros, ventana de entrenamiento y fecha; devolver incertidumbre y permitir comparar con observaciones posteriores. Probar que el entrenamiento no usa datos posteriores al corte. |
| **B7. Backtesting** | RF-49–53 | Separar configuración y evaluación temporal. Guardar parámetros y resultados; devolver serie histórica, métricas y comparación con el benchmark cuando esté configurado. Definir rebalanceos y costes antes de calcular. Probar que ningún dato de evaluación se usa para definir la estrategia. |
| **B8. Reportes** | RF-54–58 | Completar el resumen con la procedencia, fechas, moneda y detalle de métricas, y preparar CSV de resultados principales. Verificar que el archivo corresponda al análisis visible y que no incluya datos de otras cuentas. |

B4 reutiliza el flujo de simulación existente y no tiene que esperar todo el versionado de B3. B5 y B7 deben consumir una versión de cartera o pesos identificables para que los resultados puedan repetirse. B6 y B7 pueden desarrollarse independientemente una vez definido el tratamiento de las series históricas.

## Contrato con frontend

Antes de integrar cada módulo, publicar en [API.md](../tecnica/API.md) la ruta y el método reales, los campos de entrada y salida, un ejemplo de éxito y los errores esperados. Acordar unidades (fracción frente a porcentaje), moneda, fechas efectivas, tratamiento de nulos y códigos de datos insuficientes, restricciones inviables y acceso denegado. Pasar al agente de frontend un JSON verificado por las pruebas del backend; no pedirle que dependa de un endpoint todavía hipotético.

La API Julia aplica autorización usando el actor autenticado. Next.js llama desde el servidor; el navegador no envía identidades de otros usuarios ni recibe claves de proveedores. El backend es la fuente de verdad de cálculos financieros y persistencia.

## Verificación y entrega

- Probar el dominio con series deterministas, la API por su interfaz HTTP y las escrituras, concurrencia y aislamiento con PostgreSQL temporal y datos de prueba.
- Para RF-12, usar una fuente simulada en pruebas y comprobar que no se repite una consulta pagada si falla el guardado. No activar indicadores, aplicar migraciones en producción ni ejecutar Apify sin autorización específica.
- Registrar por entrega el RF, estado (local, publicado o desplegado), comando y resultado de pruebas, commit y siguiente tarea pendiente en Engram o en la documentación del proyecto.

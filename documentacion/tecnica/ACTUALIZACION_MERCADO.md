# Actualización manual de activos seguidos

RF-12 registra solicitudes desde **Mercado** y procesa hasta cinco símbolos por
ejecución. El usuario no espera al proveedor. Ambas funciones están apagadas
por defecto; este cambio no modifica el despliegue ni el cron del catálogo.

## Activación controlada

1. Aplicar primero la migración `0005_actualizacion_mercado.sql` con el rol del
   backend. No altera las tablas anteriores.
2. Configurar una tarea de Railway con el comando
   `julia --project=. scripts/process_market_refresh.jl`. Solo esa tarea necesita
   `MARKET_REFRESH_WORKER_ENABLED=true`, `DATABASE_URL` y `APIFY_TOKEN`. Evitar
   solapar su horario con `sync_prices.jl --catalogo`: el cron general no pasa
   por la cola y puede consultar los mismos símbolos.
3. Confirmar primero la operación de la tarea. Luego establecer
   `MARKET_REFRESH_REQUESTS_ENABLED=true` solo en la API de Railway para mostrar
   el botón. No agregar el token de Apify a Vercel ni copiarlo a la API.

## Límites y recuperación

- Una fila durable por símbolo agrupa solicitudes de varias cuentas. Un trabajo
  pendiente o en curso no se duplica. Un trabajo terminado solo se puede volver
  a solicitar a partir del siguiente día UTC de su última solicitud e inicio.
- No se aceptan símbolos que identifiquen varios activos del catálogo. Si la
  fuente devuelve el mismo símbolo de otro mercado, no se guardan esos datos.
- Si se pierde la conexión al reclamar o el proceso se interrumpe, un trabajo
  puede quedar en curso. No se reintenta automáticamente: la consulta anterior
  pudo haber generado un cargo. Revisar los logs y confirmar que el consumidor
  terminó antes de que un operador autorizado lo marque como fallido.
- Para desactivar, quitar primero el indicador de la API y luego apagar la
  tarea. La lista y los precios ya almacenados siguen disponibles.

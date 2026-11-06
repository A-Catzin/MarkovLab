# Precios desde la API de mercado (Apify)

Los precios históricos ya no dependen de un CSV. El backend corre en Apify el Actor [`kaix/yahoo-finance-scraper`](https://apify.com/kaix/yahoo-finance-scraper), que lee Yahoo Finance, y guarda los precios diarios en la base con origen `api`.

Se eligió así (comparativa del 2026-11-05/06 en `mis-docs/odd/`):
- Es la única opción barata que cubre **EE. UU. y la BMV** juntas. En la BMV se usa el símbolo de Yahoo con `.MX`, por ejemplo `WALMEX.MX`.
- Cobra **por activo, no por día de precio**. Por eso cargar 20 años de un activo cuesta lo mismo que cargar un día.

## Uso

Desde la raíz del repositorio, con `DATABASE_URL` y `APIFY_TOKEN` en `backend/.env`:

```bash
set -a; source backend/.env; set +a

# Carga histórica: todo desde una fecha
julia --project=backend backend/scripts/sync_prices.jl AAPL WALMEX.MX --desde 2000-01-01

# Actualización: cada símbolo sigue desde su último precio guardado
julia --project=backend backend/scripts/sync_prices.jl AAPL WALMEX.MX

# Actualización de todo el catálogo (para la tarea diaria)
julia --project=backend backend/scripts/sync_prices.jl --catalogo
```

Salida de la carga histórica del 2026-11-06 (contra una base de prueba):

```
AAPL         completa  6752 nuevos, 0 ya guardados, 0 inválidos
WALMEX.MX    parcial   6024 nuevos, 0 ya guardados, 5 inválidos
    fila 2167: high (34.0) must be greater than or equal to open, low and close
```

Cada símbolo queda en `/admin/importaciones` con origen `api`, y aparece en `/admin/activos` con su nombre, mercado, categoría y moneda tomados de Yahoo.

## Costo

| | Precio |
|---|---|
| Por símbolo y corrida (con cualquier cantidad de días) | $0.0005 |
| Inicio de corrida | $0.00005 |
| Plan gratis de Apify | $5 al mes (lo que no se usa no se acumula) |

Ejemplos: 100 activos cuestan **$0.05** en la carga histórica y unos **$1.10 al mes** con la actualización diaria (22 días hábiles). Hasta unos 200 activos entra todo en el plan gratis.

Un símbolo que ya está al día **no se consulta**, así que volver a correr la actualización no gasta cuota.

## Reglas

- **Siempre con fechas e intervalo diario.** Con `chartRange: "max"`, Yahoo resume el historial: el 2026-11-06 devolvió barras trimestrales para AAPL y mensuales para WALMEX. El adaptador pide `chartStartDate`/`chartEndDate` con `1d`, y rechaza una serie que no sea diaria.
- **El día en curso nunca se guarda.** Yahoo manda el día que todavía se está operando, con datos parciales, y un precio guardado no se vuelve a escribir. Se descartan los precios del día en curso según la zona horaria del mercado. Por eso `--hasta` es ayer por defecto.
- **La fecha es la del mercado** (`timestamp + gmtoffset`), no la del servidor. Se redondea al día más cercano, porque `gmtoffset` es el de hoy y en fechas con horario de verano la hora queda corrida. Comprobado con datos reales de verano: el cierre de AAPL del 2024-07-15 (lunes) da 234.40, y no hay ningún precio en fin de semana.
- **Cada símbolo guarda desde su propio inicio.** La actualización hace una sola consulta desde el inicio más antiguo, pero no rellena hacia atrás a los demás símbolos.
- **Un activo cargado solo por CSV** no tiene precios de origen `api`: su primera sincronización trae el historial desde 2000.
- **Las filas inválidas no detienen la carga.** Pasan por las mismas reglas que el CSV (`PriceBar`): precios positivos, el máximo arriba de la apertura, el mínimo y el cierre, etc. Las que fallan se cuentan y la importación queda `parcial`. Yahoo trae algunas así en la historia de la BMV.
- **Sin duplicados.** Un precio se guarda una vez por activo, fecha y origen. Los precios de la API y los de un CSV del mismo día conviven, porque tienen distinto origen.
- **Mercado y categoría:**
  - Mercado, según la bolsa de Yahoo: `NMS`/`NGM`/`NCM` → `NASDAQ`, `NYQ` → `NYSE`, `PCX` → `NYSEARCA`, `MEX` → `BMV`. Otra bolsa conserva su nombre de Yahoo, en mayúsculas.
  - Categoría: `EQUITY` → `Acción`, `ETF` → `ETF`, etc.
  - El símbolo se guarda tal como lo usa Yahoo (`WALMEX.MX`), para poder pedirlo de nuevo.
- **Un símbolo que Yahoo no conoce, o uno nuevo que no trajo precios,** queda como importación `fallida`, sin activo, con el motivo.
- **Si Apify no responde** (caída, error HTTP, tiempo agotado), cada símbolo pendiente queda como `fallida` con el motivo, por ejemplo `Apify answered HTTP 503`.
- Hasta 50 símbolos por corrida.

## Seguridad

- `APIFY_TOKEN` vive solo en `backend/.env` (en `.gitignore`) o en el entorno del despliegue.
- Viaja solo en el encabezado `Authorization`, nunca en la URL.
- Ni los mensajes de error ni la representación de `ApifyMarketData` lo incluyen: se muestra como `token=<oculto>`. Un error de red se reduce a su tipo (`could not reach Apify (ConnectError)`). Lo revisó un verificador independiente forzando caídas, tiempos agotados y respuestas inválidas: el token no apareció en ningún mensaje. La excepción es `dump(...)` en una sesión interactiva, que muestra todos los campos.
- Solo lo necesita `sync_prices.jl`; el servidor de la API no lo lee.

## Riesgos

- **No es una API oficial.** El Actor lee Yahoo Finance; si Yahoo cambia, puede dejar de funcionar sin aviso. Si pasa, se cambia el adaptador (`ApifyMarketData`) y el resto del sistema no se entera: el servicio solo conoce el puerto `MarketDataSource`.
- **El Actor es de un tercero** de la tienda de Apify, con pocas reseñas.

## Código

| Capa | Archivos |
|---|---|
| Dominio | `backend/src/domain/market_data.jl`: `MarketSeries` y el puerto `MarketDataSource` (`fetch_daily_prices`). `domain/assets.jl`: `save_price_import(...; source)`, `latest_price_date` y `PRICE_SOURCES`. |
| Servicio | `backend/src/services/market_sync.jl`: `sync_market_prices` (carga histórica y actualización). |
| Adaptadores | `backend/src/infrastructure/apify_market_data.jl`: `ApifyMarketData`, `actor_input` y `parse_actor_items`. `postgres_prices.jl` y `memory_prices.jl` guardan el origen. |
| Script | `backend/scripts/sync_prices.jl`. |

## Pruebas

- `backend/test/infrastructure/apify_market_data_tests.jl`:
  - Lectura de la respuesta del Actor: fechas locales, el día en curso descartado, filas inválidas, mercados y categorías.
  - Series no diarias o con error.
  - La entrada del Actor.
  - Que el token no se muestre.
- `backend/test/services/market_sync_tests.jl` (con una fuente falsa):
  - Carga histórica, actualización desde el último precio y símbolos al día sin consulta.
  - Símbolos fallidos, importación parcial, convivencia con el CSV y validación de la lista.
- `backend/test/infrastructure/postgres_prices_tests.jl`: origen `api` en `precios_historicos` y `sincronizaciones`, y `latest_price_date` contra PostgreSQL.
- De punta a punta (2026-11-06), con Apify real y PostgreSQL de prueba:
  - Carga histórica de AAPL y WALMEX.MX (la salida de arriba).
  - Una segunda corrida sin precios nuevos.
  - El cierre de AAPL del 2024-06-10 (193.12) coincide con el real.

## Siguiente paso

Programar la actualización diaria (`--catalogo`) después del cierre del mercado. Por ejemplo, un cron en Railway.

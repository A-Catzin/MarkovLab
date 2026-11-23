# API HTTP del backend

Contrato HTTP/JSON entre el frontend y el backend Julia (SRS 6.3). Implementado con [Oxygen.jl](https://github.com/oxygenframework/Oxygen.jl) en `backend/src/api/`; los cálculos viven en `services/` y `domain/`.

## Ejecución local

```bash
julia --project=backend backend/scripts/serve.jl
# o con configuración explícita
PORT=8080 ALLOWED_ORIGINS="http://localhost:3000" julia --project=backend backend/scripts/serve.jl
```

| Variable | Valor por defecto | Uso |
|---|---|---|
| `HOST` | `0.0.0.0` | Interfaz de escucha. |
| `PORT` | `8080` | Puerto; Railway lo define automáticamente. |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Orígenes del frontend separados por comas; `*` permite cualquiera (solo desarrollo). |
| `DATABASE_URL` | vacío | PostgreSQL para las rutas internas que leen o escriben datos (usuarios, catálogo, importaciones, carteras, simulaciones y tipos de cambio). Sin ella, esas rutas responden 503. |
| `INTERNAL_API_KEY` | vacío | Clave de las rutas internas (al menos 32 caracteres). Sin ella, esas rutas responden 503. |

Oxygen publica además documentación interactiva generada automáticamente en `/docs`.

## Convenciones

- Cuerpos y respuestas en JSON (`Content-Type: application/json`).
- Rendimientos, pesos y riesgos como fracciones: `0.05` equivale a 5 %.
- Los precios son series ordenadas de la más antigua a la más reciente.
- Los campos opcionales pueden omitirse o enviarse como `null`.

## Errores

Todos los errores devuelven el mismo formato:

```json
{ "error": "invalid_input", "message": "weights must sum to 1 (100 %), got 0.9" }
```

| Estado | `error` | Cuándo |
|---|---|---|
| 400 | `invalid_json` | El cuerpo no es JSON válido. |
| 400 | `invalid_input` | Falta un campo, tiene otro tipo o viola una regla (pesos, precios, límites). |
| 401 | `unauthorized` | Ruta interna sin `X-Internal-Key` o con una clave incorrecta. |
| 403 | `forbidden` | Ruta de usuario o de admin sin `X-Actor-Id`, con un actor inexistente o que no es admin según la base. |
| 404 | `not_found` | El usuario o la cartera pedida no existe (o pertenece a otro usuario). |
| 409 | `email_conflict` | El correo ya pertenece a otra cuenta de Google. |
| 409 | `last_admin` | Se intentó quitar el rol al último admin. |
| 422 | `insufficient_data` | No hay observaciones suficientes para el cálculo (RF-20). |
| 422 | `missing_exchange_rate` | Una cartera tiene activos en otra moneda y falta el tipo de cambio para convertirlos. |
| 500 | `internal_error` | Error inesperado; el detalle se registra en el servidor y no se expone. |
| 503 | `not_configured` | Falta `INTERNAL_API_KEY` o `DATABASE_URL` para una ruta interna. |
| 503 | `database_unavailable` | La base no responde; el detalle queda en el registro del servidor. |

## Endpoints

### `GET /health`

Estado del servicio; útil para Railway y para comprobar la conexión desde el frontend.

```json
{ "status": "ok", "service": "markovlab-backend", "version": "0.1.0" }
```

### `POST /api/analysis/metrics`

Métricas principales de una serie de precios (RF-15, RF-16, RF-20).

**Solicitud**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `prices` | `number[]` | Sí | Al menos 3 precios positivos. |
| `periods_per_year` | `number` | No | Para anualizar la volatilidad (252 diario, 52 semanal, 12 mensual). |

```json
{ "prices": [100, 110, 99, 108.9], "periods_per_year": 252 }
```

**Respuesta 200**

```json
{
  "observations": 4,
  "cumulative_return": 0.089,
  "mean_return": 0.0333,
  "volatility": 0.1155,
  "annualized_volatility": 1.833,
  "max_drawdown": -0.1
}
```

`annualized_volatility` es `null` si no se envía `periods_per_year`. Definiciones en [`METRICAS_DOMINIO.md`](METRICAS_DOMINIO.md).

### Predicción de activos (B6, RF-21 a RF-26)

Ambas rutas requieren `X-Internal-Key` y `X-Actor-Id`. Requieren la migración
`0008_predicciones_activos.sql`. Solo el actor que generó el pronóstico puede consultarlo.

| Método y ruta | Entrada | Resultado |
|---|---|---|
| `POST /api/internal/assets/{id}/predictions` | ID numérico del activo; cuerpo `{"metric":"return","horizon_days":21,"as_of":"2024-02-29"}`. Sin query. | **201**, pronóstico nuevo con UUID y fecha UTC. |
| `GET /api/internal/predictions/{id}` | UUID devuelto por el POST; sin query ni cuerpo. | **200**, el mismo entrenamiento y pronóstico, con evaluación actualizada según los cierres disponibles. |

`metric` admite `return` (fracción por sesión) o `volatility` (fracción anualizada).
`horizon_days` admite 21, 63 o 126 **sesiones**. `as_of` es opcional (ISO
`YYYY-MM-DD`): si se omite, se usa el último cierre disponible. No puede excederlo.
El modelo y sus limitaciones están en [PREDICCION.md](PREDICCION.md).

La respuesta contiene:

- `id`, `asset_id`, `symbol`, `market`, `calculated_at`, `as_of`,
  `metric`, `horizon_days` y `model` (`empirical_stationary_v1`).
- `parameters: { confidence, max_training_closes, volatility_sessions, sessions_per_year }`;
  `training_window: { from, to, observations }` (fechas ISO y número de valores de la métrica).
- `point`, `lower_bound`, `upper_bound` y `limitations: string[]`.
- `series: [{ date, phase, date_estimated, historical_value, forecast_point,
  lower_bound, upper_bound, observed_after_value }]`. `phase` es `historical`
  o `forecast`; los campos numéricos no aplicables son `null`. Las sesiones
  aún no observadas se muestran como fechas hábiles estimadas (sin calendario
  de feriados). Cuando hay un cierre real, se usa su fecha.
- `evaluation: null` sin cierres posteriores o `{ observed_points, mae, rmse,
  interval_coverage }`. Un GET no reentrena ni escribe.

| Código HTTP | Error |
|---|---|
| 400 | `invalid_input` para ID de activo, fecha, métrica o horizonte inválidos; `invalid_json` para JSON malformado. |
| 401 / 403 | `unauthorized` o `forbidden`: clave o actor inválidos. |
| 404 | `not_found`: no existe el activo o la predicción no existe o es de otro actor. |
| 422 | `insufficient_data`: menos de 60 cierres hasta el corte. |
| 503 | `not_configured` o `database_unavailable`: falta configuración o falla la base. |

### `POST /api/internal/analysis/assets` (B2, RF-15 a RF-20)

Requiere `X-Internal-Key` y `X-Actor-Id`. No usa query ni acepta precios del
cliente: consulta los cierres almacenados del catálogo (`GET /api/internal/assets`).
Cuerpo JSON:

```json
{
  "symbols": ["AAPL", "MSFT"],
  "period": "custom",
  "from": "2024-06-03",
  "to": "2024-06-07",
  "return_kind": "simple"
}
```

- `symbols` contiene de 1 a 12 símbolos de catálogo distintos, de hasta 64 caracteres;
  se normalizan a mayúsculas y se conserva el orden. No se acepta un símbolo que
  identifique varios mercados.
- `period`: `3M`, `6M`, `1A` (por defecto), `3A` o `custom`. Para
  `custom`, `from` y `to` son fechas ISO inclusivas; `from < to` y máximo
  20 años. Los preajustes omiten ambas fechas y terminan el día anterior en UTC.
- `return_kind`: `simple` (por defecto) o `log`. Determina la media,
  volatilidad y correlación. Los rendimientos totales se devuelven en ambas
  convenciones; el acumulado compuesto siempre usa rendimientos simples.

**200:** ejemplo para una consulta de un activo con dos cierres comunes:

```json
{
  "selected_symbols": ["AAPL"],
  "period_preset": "custom",
  "return_kind": "simple",
  "requested_from": "2024-06-03",
  "requested_to": "2024-06-04",
  "effective_from": "2024-06-03",
  "effective_to": "2024-06-04",
  "aligned_observations": 2,
  "annualization_factor": 252,
  "per_asset_metrics": [{
    "asset_id": 1, "symbol": "AAPL", "name": "Apple", "currency": "USD",
    "observations": 2, "effective_from": "2024-06-03", "effective_to": "2024-06-04",
    "simple_return": 0.10, "log_return": 0.09531018, "cumulative_return": 0.10,
    "mean_return_daily": 0.10, "volatility_daily": null, "volatility_annualized": null,
    "max_drawdown": 0, "peak_date": "2024-06-03", "trough_date": "2024-06-03"
  }],
  "series_aligned": [{"symbol": "AAPL", "points": [["2024-06-03", 100], ["2024-06-04", 110]]}],
  "correlation_symbols": ["AAPL"],
  "correlation_matrix": [[null]]
}
```

Se usan solo fechas con cierre de todos los símbolos, sin interpolar ni arrastrar
cierres. Las series están en base 100 y los rendimientos se calculan en la moneda
de cotización, sin conversión. Los campos `*_daily` miden intervalos entre
cierres comunes; esos intervalos pueden abarcar varios días. La anualización
usa `sqrt(252)` como aproximación. Con solo dos cierres comunes hay un retorno:
volatilidad y Pearson son nulos. La matriz también usa `null` para pares sin
varianza; las correlaciones definidas tienen diagonal 1. Si no hubo caída,
las fechas de pico y valle coinciden.

- **400** `invalid_input` o `invalid_json`: parámetros, fechas o símbolos inválidos.
- **401** `unauthorized`: clave interna ausente o incorrecta.
- **403** `forbidden`: actor ausente o desconocido.
- **422** `insufficient_data`: menos de dos cierres comunes. Incluye
  `required_sessions: 2` y `observed_sessions`, además de `error` y `message`.
- **503** `not_configured` o `database_unavailable`: servicio o base no disponibles.

### `POST /api/risk/monte-carlo`

Simulación Monte Carlo de una cartera con VaR y CVaR (RF-41 a RF-44, RF-48). Estima rendimientos esperados y covarianza a partir de los precios enviados.

**Solicitud**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `assets` | `object[]` | Sí | Un elemento por activo. |
| `assets[].symbol` | `string` | Sí | Símbolo; se normaliza a mayúsculas y debe ser único. |
| `assets[].weight` | `number` | Sí | Entre 0 y 1; los pesos deben sumar 1 (RF-29). |
| `assets[].prices` | `number[]` | Sí | Precios alineados por fecha; todas las series con igual longitud y al menos 3 precios. |
| `simulations` | `integer` | No | Escenarios, de 1 a 100.000. Por defecto 10.000. |
| `horizon` | `integer` | No | Períodos simulados, de 1 a 2.520, en la frecuencia de los precios. Por defecto 1. |
| `confidence` | `number` | No | Nivel de confianza, estrictamente entre 0 y 1. Por defecto 0,95. |
| `seed` | `integer` | No | Semilla para reproducir el resultado; si se omite, se genera y se devuelve. |

```json
{
  "assets": [
    { "symbol": "AAPL", "weight": 0.6, "prices": [100, 101, 99.5, 102, 103] },
    { "symbol": "MSFT", "weight": 0.4, "prices": [50, 49, 50.5, 51, 50] }
  ],
  "simulations": 10000,
  "horizon": 21,
  "confidence": 0.95,
  "seed": 42
}
```

**Respuesta 200**

```json
{
  "parameters": {
    "symbols": ["AAPL", "MSFT"], "weights": [0.6, 0.4],
    "simulations": 10000, "horizon": 21, "confidence": 0.95, "seed": 42, "observations": 5
  },
  "model": "normal-rebalanced-v1",
  "expected_period_return": 0.0046,
  "expected_period_volatility": 0.0099,
  "summary": {
    "scenarios": 10000,
    "mean": 0.1008, "worst": -0.101, "best": 0.3222,
    "percentiles": { "1": -0.0089, "5": 0.0211, "25": 0.0666, "50": 0.0996, "75": 0.1344, "95": 0.1842, "99": 0.2196 },
    "confidence": 0.95,
    "value_at_risk": -0.0211,
    "conditional_value_at_risk": -0.0022
  }
}
```

- `parameters` y `model` contienen todo lo necesario para reproducir y guardar la simulación (RF-47, RNF-17).
- `value_at_risk` y `conditional_value_at_risk` son pérdidas positivas; un valor negativo significa que incluso la cola es ganancia.
- Las claves de `percentiles` son cadenas por requisito de JSON.

Modelo y fórmulas en [`SIMULACION_RIESGO.md`](SIMULACION_RIESGO.md).

### `POST /api/internal/users/google`

**Ruta interna.** Solo la llama el servidor de Next.js (Auth.js) cuando alguien entra con Google; el navegador nunca la usa. El flujo completo está en [AUTENTICACION.md](AUTENTICACION.md).

Requiere el encabezado `X-Internal-Key` con el valor de `INTERNAL_API_KEY`. La clave se revisa antes de leer el cuerpo.

| Campo | Tipo | Obligatorio |
|---|---|---|
| `google_sub` | `string` (1 a 255 caracteres) | Sí |
| `email` | `string` con forma `usuario@dominio` | Sí |
| `name` | `string` o `null` | No |

```json
{ "google_sub": "1098765432", "email": "Ana@Example.com", "name": "Ana López" }
```

Crea el usuario o actualiza al que tiene el mismo `google_sub`. El correo se guarda en minúsculas y un nombre vacío se guarda como `null`.

```json
{ "id": "68c8f646-e505-432b-b856-396f04580976", "email": "ana@example.com", "display_name": "Ana López", "role": "user" }
```

Un usuario nuevo entra con rol `user`; volver a entrar no cambia el rol.

### `GET /api/internal/users/{id}`

**Ruta interna.** Devuelve el usuario con el mismo formato (incluido `role`). Next.js la usa para refrescar el rol de la sesión cada minuto. 404 si no existe.

### Rutas internas de usuario

Exigen `X-Internal-Key` y `X-Actor-Id` con el id de un usuario que exista en la base (si no, 403 `forbidden`). Cada usuario ve y modifica **solo sus carteras**: la cartera de otro responde 404, como si no existiera. Detalle en [CARTERAS.md](CARTERAS.md).

| Ruta | Respuesta |
|---|---|
| `GET /api/internal/assets` | `{ assets: [...] }` con el mismo formato que la ruta de admin: el catálogo para elegir activos. |
| `GET /api/internal/portfolios` | `{ portfolios: [cartera, ...] }`, de la más nueva a la más vieja. |
| `POST /api/internal/portfolios` | Cuerpo `{ name, capital, currency, start_date?, positions: [{ asset_id, weight }] }`, con pesos como fracciones que suman 1. Responde **201** con la cartera. Errores: 400 `invalid_input` (nombre, capital, moneda, pesos, activos repetidos o inexistentes). |
| `GET /api/internal/portfolios/{id}` | La cartera, o 404 si no existe o es de otro usuario. |
| `POST /api/internal/portfolios/{id}/simulations` | Simula la cartera con los precios de la base y guarda el resultado. Cuerpo: `{ horizon, simulations?, confidence?, lookback_years?, seed? }` (`horizon` en días hábiles; por defecto 10,000 escenarios, 95 % y 5 años). Responde 201 con `{ id, portfolio_id, model, simulations, horizon, confidence, seed, observations, symbols, weights, window: { from, to }, expected_return, expected_volatility, value_at_risk, conditional_value_at_risk, summary, created_at }`. 400 con parámetros fuera de rango, 404 si la cartera no es del usuario, 422 `insufficient_data` si no hay 60 días de precios en común, o `missing_exchange_rate` si falta un tipo de cambio. Los precios se convierten a la moneda de la cartera ([CARTERAS.md](CARTERAS.md#moneda)). |
| `GET /api/internal/portfolios/{id}/simulations` | `{ simulations: [...] }`, las 20 más recientes de la cartera, con la misma forma. 404 si la cartera no es del usuario. |
| `GET /api/internal/portfolios/{id}/history` | `{ currency, capital, anchor_date, points: [[fecha, valor], …] }`: valor diario de comprar y mantener, anclado en el día de alta (ver [CARTERAS.md](CARTERAS.md#valor-histórico)). 404 en los mismos casos; 422 `insufficient_data` si los activos no tienen al menos dos días de precios en común, o `missing_exchange_rate` si falta un tipo de cambio. Los valores van en la moneda de la cartera. |
| `DELETE /api/internal/portfolios/{id}` | `{ deleted: id }`, o 404 en los mismos casos. |

Cada cartera tiene esta forma:

```json
{ "id": "e295e3ff-…", "name": "Tecnología", "capital": 10000.0, "currency": "USD", "start_date": "2026-11-05",
  "status": "draft", "created_at": "2026-11-05T18:26:01Z",
  "positions": [{ "asset_id": 1, "symbol": "AAPL", "market": "NASDAQ", "name": "Apple", "weight": 0.6, "currency": "USD" }] }
```

### Edición, versiones y duplicación de carteras (B3)

Usa `X-Internal-Key` y `X-Actor-Id`; no hay parámetros query. El objeto cartera
es el mismo del alta y el detalle: `id`, `name`, `capital`, `currency`,
`start_date`, `status`, `created_at`, `positions[]`. En el alta,
`start_date` es ISO `YYYY-MM-DD` y opcional; si falta o es `null`, se conserva
el comportamiento de usar la fecha actual de la base.

| Método y ruta | Cuerpo JSON | Respuesta |
|---|---|---|
| `PUT /api/internal/portfolios/{id}` | `{ "name": "Mi cartera", "capital": 1000, "currency": "USD", "start_date": "2024-06-01", "positions": [{"asset_id": 1, "weight": 1}] }`. Solo `start_date` es opcional; omitido o `null` mantiene la fecha actual de la cartera. Reemplaza todas las posiciones. | **200** objeto cartera actualizado, mismo `id`. La versión previa se conserva en la misma transacción. |
| `GET /api/internal/portfolios/{id}/versions` | Sin cuerpo. | **200** `{ "versions": [...] }`: versión actual seguida de anteriores, de mayor a menor número. |
| `POST /api/internal/portfolios/{id}/duplicate` | `{}` o `{"name":"Nuevo nombre"}`. Sin nombre usa el nombre original con sufijo « (copia)». | **201** objeto cartera nueva con `derived_from_id` igual al original. Copia fecha, capital, moneda y pesos, empieza como borrador y versión 1. El original queda intacto. |

Cada elemento de `versions` incluye `id` (texto estable `cartera_uuid:número`),
`version_number` (entero desde 1), `is_current` (booleano), `name`, `capital`,
`currency`, `start_date`, `created_at` (ISO UTC, fecha de la versión),
`derived_from_id`, `derived_from_name` (nulos si no aplica),
`estimated_annual_return` y `estimated_annual_volatility` (nulos, no se
recalculan aquí), y `positions: [{asset_id,symbol,name,weight}]`.
Las simulaciones ya guardadas conservan sus propios parámetros y pesos.

Errores: **400** `invalid_input` o `invalid_json` para cuerpo, pesos, fechas o
activos inválidos; **401** `unauthorized`; **403** `forbidden`;
**404** `not_found` si la cartera no existe o es ajena; **503** `not_configured`
o `database_unavailable`. Las escrituras fallidas no crean versiones parciales.
Aplicar la migración `0006_versiones_cartera.sql` antes de usar estas rutas
en producción; la migración agrega una tabla y no reescribe carteras existentes.

### Backtesting de carteras (B7, RF-49 a RF-53)

Requiere `X-Internal-Key`, `X-Actor-Id` y `0009_backtests_cartera.sql`.
Solo el propietario puede guardar y leer las ejecuciones. El backtest no cambia la cartera.

| Método y ruta | Entrada | Resultado |
|---|---|---|
| `POST /api/internal/portfolios/{id}/backtests` | JSON, sin query (ver ejemplo). | **201**, ejecución guardada. |
| `GET /api/internal/portfolios/{id}/backtests` | Sin cuerpo ni query. | **200**, `{"backtests":[ejecución, ...]}`, hasta 20, más recientes primero. |

```json
{
  "strategy": "min_variance",
  "config_from": "2022-01-01",
  "config_to": "2024-12-31",
  "eval_from": "2025-01-01",
  "eval_to": "2025-12-31",
  "rebalance": "quarterly",
  "transaction_cost_bps": 10,
  "risk_free_rate": 0.02,
  "benchmark_id": 17
}
```

- `strategy` es `manual`, `min_variance` o `max_sharpe`. Las cuatro fechas
  ISO son obligatorias e inclusivas; `config_from < config_to < eval_from < eval_to`.
- `rebalance`: `none` (predeterminado), `monthly`, `quarterly` o `semiannual`.
  `transaction_cost_bps` va de 0 a 1000 y `risk_free_rate`, de −1 a 1 (fracción
  anual); ambos valen 0 si se omiten.
- `benchmark_id` es opcional y debe ser un ID positivo del catálogo. Estrategia
  y benchmark se evalúan en sesiones comunes y moneda de la cartera. La
  configuración no utiliza el benchmark ni datos de evaluación.

Cada ejecución devuelve:

- `id`, `portfolio_id`, `portfolio_version`, `portfolio_name`, `currency`,
  `executed_at` (UTC) y `model` (`fixed_target_rebalance_v1`).
- Parámetros: `strategy`, `config_from`, `config_to`, `eval_from`, `eval_to`,
  `rebalance`, `transaction_cost_bps` y `risk_free_rate`.
- `configuration` y `evaluation`: `{from,to,observations}` con fechas efectivas
  y número de cierres comunes. `weights: [{asset_id,symbol,market,manual_weight,target_weight}]`.
- `benchmark: null` o `{asset_id,symbol,market,currency}` (moneda original).
  `strategy_metrics` y `benchmark_metrics` contienen `cumulative_return`,
  `annualized_return`, `annualized_volatility`, `max_drawdown` y `sharpe_ratio`.
  `benchmark_metrics` es `null` sin benchmark; Sharpe es `null` si la volatilidad es cero.
- `curve: [{date,phase,strategy_index,benchmark_index}]`, con `phase` igual a
  `config` o `evaluation`; `benchmark_index` es `null` fuera de evaluación
  o sin benchmark. Las curvas se reinician antes de costes en cada fase.

Consultar [BACKTESTING.md](BACKTESTING.md) para costes, rebalanceo y limitaciones.

| HTTP | Error |
|---|---|
| 400 | `invalid_json` o `invalid_input`: cuerpo, fechas o parámetros inválidos. |
| 401 / 403 | `unauthorized` o `forbidden`: clave o actor inválido. |
| 404 | `not_found`: cartera inaccesible o benchmark inexistente. |
| 422 | `insufficient_data`, `missing_exchange_rate`, `undefined_sharpe` u `optimization_infeasible`: datos o restricciones no permiten calibrar o evaluar. |
| 503 | `not_configured`, `database_unavailable` u `optimization_unavailable`: falta configuración, falla la base o el solver no certificó una solución. |

### Optimización de carteras (B5, RF-34 a RF-40)

Requiere `X-Internal-Key`, `X-Actor-Id` de un usuario existente y la migración
`0007_optimizaciones_cartera.sql`. Solo el propietario puede crear y consultar
optimizaciones. Ninguna operación modifica los pesos de la cartera.

| Método y ruta | Entrada | Resultado |
|---|---|---|
| `POST /api/internal/portfolios/{id}/optimizations` | JSON que se describe abajo. No usa query. | **201**, ejecución nueva guardada. |
| `GET /api/internal/portfolios/{id}/optimizations` | Sin cuerpo ni query. | **200**, `{"optimizations":[ejecución, ...]}`, hasta 20, más nuevas primero. |

Ejemplo de solicitud:

```json
{
  "objective": "min_variance",
  "bounds": [{"asset_id": 17, "min_weight": 0.1, "max_weight": 0.6}],
  "lookback_years": 5,
  "risk_free_rate": 0.02,
  "max_volatility": 0.30
}
```

- `objective` es obligatorio: `"min_variance"` o `"max_sharpe"`.
- Los límites son fracciones entre 0 y 1; solo se admiten activos de la cartera,
  sin repetidos. Si un activo no aparece en `bounds`, se aplica [0, 1].
  Los pesos optimizados suman 1. `lookback_years` va de 1 a 20, por defecto 5.
- La tasa libre de riesgo efectiva del modelo es una fracción anual entre −1 y 1,
  por defecto 0. `max_volatility` es una fracción anual no negativa; se puede omitir.
- Se usan hasta los años solicitados desde la última fecha común, con un mínimo de
  60 cierres comunes, sin rellenar. Los precios se convierten a la moneda de la
  cartera. Las medias aritméticas y la covarianza muestral de rendimientos simples
  diarios se multiplican por 252 para anualizarlas.

Ejemplo de ejecución (un activo):

```json
{
  "id": "1bd7c2c0-a264-4fa0-8325-c31e7aaf2b4b",
  "created_at": "2026-11-22T18:00:00Z",
  "portfolio_id": "25e0791a-5c39-43af-b0c6-c715b344fd8c",
  "portfolio_version": 1, "portfolio_name": "Ejemplo",
  "capital": 1000.0, "currency": "USD", "start_date": "2024-01-02",
  "objective": "min_variance", "objective_value": 0.04,
  "return_model": "daily_simple_arithmetic_v1", "periods_per_year": 252,
  "risk_free_rate": 0.02, "lookback_years": 5, "max_volatility": null,
  "feasible_min_volatility": 0.2,
  "window": {"from": "2024-01-02", "to": "2024-04-02"}, "observations": 63,
  "weights": [{"asset_id":17,"symbol":"AAA","name":"AAA","market":"NYSE","asset_currency":"USD",
               "manual_weight":1.0,"optimized_weight":1.0,"min_weight":0.0,"max_weight":1.0}],
  "manual_stats": {"expected_annual_return":0.1,"annualized_volatility":0.2,"sharpe_ratio":0.4},
  "optimized_stats": {"expected_annual_return":0.1,"annualized_volatility":0.2,"sharpe_ratio":0.4},
  "inputs": {"annual_mean_returns":[0.1],"annual_covariance":[[0.04]]},
  "solver": "HiGHS", "solver_wrapper_version": "1.27.0"
}
```

`objective_value` es varianza anual o Sharpe con signo, según el objetivo.
Las medias y filas y columnas de la covarianza siguen el orden de `weights`. La
versión y sus pesos se capturan juntos; los insumos y el resultado no cambian cuando
se actualiza la cartera o se cargan precios nuevos. Borrar la cartera borra sus ejecuciones.
El Sharpe individual de una asignación sin volatilidad es `null`.

| HTTP | Código y significado |
|---|---|
| 400 | `invalid_json` o `invalid_input`: cuerpo o parámetros inválidos. |
| 401 / 403 | `unauthorized` o `forbidden`: clave inválida o actor inexistente. |
| 404 | `not_found`: cartera inexistente o de otro actor. |
| 422 | `optimization_infeasible`: `details.reason` es `minimum_weights_exceed_one`, `maximum_weights_below_one` o `volatility_cap_below_minimum`; `details.minimum_volatility` es el mínimo alcanzable cuando se calcula, o `null`. |
| 422 | `insufficient_data` o `missing_exchange_rate`: no se pueden estimar los insumos. |
| 422 | `undefined_sharpe`: no hay volatilidad utilizable para calcular Sharpe. Si el mínimo es cero, se excluyen riesgos inferiores al 0,01 % de la menor entre la máxima volatilidad individual y el tope. |
| 503 | `optimization_unavailable`, `not_configured` o `database_unavailable`: no se certificó una solución (por ejemplo, al agotar 10 s), no hay configuración o la base de datos no está disponible. |

### `POST /api/internal/portfolios/{id}/stress` (B4, RF-46)

Requiere `X-Internal-Key` y `X-Actor-Id`. Usa el UUID de una cartera propia; no
usa query. Cuerpo JSON de ejemplo:

```json
{
  "horizon": 21,
  "simulations": 10000,
  "confidence": 0.95,
  "lookback_years": 5,
  "seed": 42,
  "return_shift": -0.15,
  "volatility_multiplier": 1.5,
  "correlation_shift": 0.3
}
```

`horizon` es obligatorio (1–2520 días hábiles). Los demás campos son opcionales:
`simulations` 1–100000 (10000 por defecto), con un máximo de 10000000 sorteos
por escenario (`simulations × horizon`); `confidence` entre 0 y 1 (0.95);
`lookback_years` 1–20 (5); `seed` entero de 0 a 9007199254740991 (si falta se
genera y se devuelve la usada). Se requieren al menos 60 cierres comunes en la
ventana que termina en el último cierre común, convertidos a la moneda de la
cartera.

Los choques neutrales son `0, 1, 0`. `return_shift` en [-1, 1] es un cambio
en la media anual en fracciones y se divide entre 252 para aplicarlo por día.
`volatility_multiplier` en (0, 10] multiplica las desviaciones; la covarianza
se escala por su cuadrado. `correlation_shift` en [-1, 1] es la intensidad de
una mezcla: hacia correlación común 1 si es positiva, y hacia
`-1 / (n - 1)` si es negativa, donde `n` son los activos con volatilidad no
nula. Con menos de dos activos de ese tipo no modifica correlaciones. No se
recortan correlaciones individuales; la mezcla conserva una covarianza válida.

**200**, objeto JSON con estos campos exactos:

- Identidad: `portfolio_id` (UUID), `portfolio_name`, `capital` (número),
  `currency`, `model` (`normal-rebalanced-v1`).
- Calibración: `window: {from,to}` (fechas ISO), `observations` y
  `lookback_years` (enteros). `shock: {return_shift,volatility_multiplier,correlation_shift}`
  refleja los números aplicados.
- `baseline` y `stressed`: cada uno contiene `horizon_days`, `confidence`,
  `seed`, `simulations`, `expected_final_value`, `median_final_value`,
  `p5_final_value`, `p95_final_value`, `var_fraction`, `var_amount`,
  `cvar_fraction` y `cvar_amount` (todos números). Comparten semilla y secuencia
  aleatoria. VaR/CVaR positivos indican pérdida; los montos están en la moneda
  de la cartera.
- `deltas: {expected_final_value,var_fraction,var_amount,cvar_fraction,cvar_amount}`:
  escenario con estrés menos escenario base.

La operación no guarda resultados ni cambia la cartera. Los mismos datos,
parámetros y semilla reproducen la comparación.

Errores: **400** `invalid_input` o `invalid_json`; **401** `unauthorized`;
**403** `forbidden`; **404** `not_found` para carteras inexistentes o ajenas;
**422** `insufficient_data` o `missing_exchange_rate`; **503**
`not_configured` o `database_unavailable`.

### Seguimiento de mercado (RF-08 a RF-11, RF-13)

Requiere la clave interna y un actor de usuario válido. La pertenencia a la lista se
determina exclusivamente por el actor autenticado; no se acepta un ID de usuario
en la URL ni en el cuerpo.

| Ruta | Resultado |
|---|---|
| `GET /api/internal/watchlist` | `{ assets: [...] }`. Cada activo incluye `id`, `symbol`, `name`, `market`, `currency`, `latest_price`, `latest_date`, `latest_price_source`, `latest_price_status` y `changes: { daily, weekly, monthly }`. |
| `PUT /api/internal/watchlist/{id}` | Agrega un activo del catálogo a la lista y devuelve `{ asset_id }`. Si ya lo sigue, devuelve el mismo resultado sin duplicarlo. |
| `DELETE /api/internal/watchlist/{id}` | Retira el activo de la lista del actor y devuelve `{ asset_id }`. |
| `GET /api/internal/watchlist/{id}/history` | `{ points: [[fecha, cierre], …] }`, ordenados por fecha. |

Un ID inválido devuelve 400; un activo inexistente al agregarlo o ajeno a la lista
al consultar o quitarlo devuelve 404. Se usa el cierre ajustado cuando existe y,
si coinciden dos fuentes para la misma fecha, se prefiere API sobre CSV. La lista
se guarda en la tabla existente `lista_seguimiento`.

Las variaciones son fracciones: `0.02` equivale a 2 %. Se calculan desde el
último cierre disponible: la diaria usa el cierre anterior; la semanal y la
mensual usan el último cierre en o antes de la fecha de referencia (siete días
naturales y un mes calendario antes, respectivamente). Sin cierre de referencia
la variación es nula; sin precios también son nulos el último cierre y su fecha.

**Origen y vigencia (RF-13).** `latest_price_source` es el origen del cierre
que se mostró: `api`, `csv`, `manual` o `null`. `latest_price_status` toma
uno de estos valores:

| Estado | Significado |
|---|---|
| `local_file` | El cierre proviene de un CSV, independientemente de su fecha. |
| `updated` | El cierre de API coincide con el último día de lunes a viernes anterior a la fecha UTC actual. Se aplica a NASDAQ, NYSE, NYSEARCA, NYSEAMERICAN, CBOE y BMV. |
| `cached` | Hay un dato almacenado, pero la regla anterior no confirma que sea el cierre de referencia. No significa que esté obsoleto: puede haber un feriado o un mercado sin regla disponible. |
| `unavailable` | No hay un cierre guardado; origen, fecha y precio son `null`. |

La referencia no incluye la sesión en curso ni promete cotizaciones en tiempo
real; por ejemplo, el sábado, domingo y lunes UTC usan el viernes anterior.
El estado depende de la fecha del cierre, no de cuándo se importó. Los dos
campos son aditivos; la forma de `points` no cambia.

### Solicitud manual de actualización (RF-12)

`POST /api/internal/watchlist/refresh` usa el actor autenticado, no acepta símbolos del
cliente y devuelve `202 {"accepted":true}` si hay activos elegibles en su lista. Una
solicitud repetida el mismo día UTC se agrupa y no vuelve a consultar al proveedor.
Devuelve `422 no_refreshable_assets` si la lista está vacía o solo contiene símbolos
ambiguos, y `503 refresh_disabled` cuando la función está apagada. Si está habilitada,
`GET /api/internal/watchlist` incluye `can_request_refresh: true`.

La API solo registra la solicitud; no usa Apify. El consumidor y los pasos de puesta
en marcha están en [ACTUALIZACION_MERCADO.md](ACTUALIZACION_MERCADO.md).

### Rutas internas de admin

Además de `X-Internal-Key`, exigen `X-Actor-Id` con el id del usuario que navega. El backend verifica **en la base** que ese usuario sea admin y, si no, responde 403 `forbidden` sin datos. Detalle en [ROLES.md](ROLES.md).

| Ruta | Respuesta |
|---|---|
| `GET /api/internal/admin/summary` | `{ users, admins, assets, price_rows, last_import }`; `last_import` es `null` si no hubo ninguna. |
| `GET /api/internal/admin/assets` | `{ assets: [{ id, symbol, name, market, category, currency, last_synced_at, price_rows, first_date, last_date }] }` |
| `GET /api/internal/admin/imports?limit=50` | `{ imports: [{ id, source, status, asset_symbol, asset_market, saved, failed, message, started_at, finished_at }] }`; `limit` entre 1 y 500. |
| `GET /api/internal/admin/users` | `{ users: [{ id, email, display_name, role }] }` |
| `POST /api/internal/admin/prices/import` | Cuerpo `{ csv, name, market, category, currency, symbol? }`, con el CSV como texto (hasta 5 MB). Devuelve `{ symbol, asset_id, status, valid_rows, inserted, already_stored, invalid_count, invalid: [{ line, message }], file_duplicates_count }`, con un máximo de 20 filas inválidas detalladas. 400 si el archivo está vacío, trae varios símbolos o le faltan columnas. |
| `PUT /api/internal/admin/users/{id}/role` | Cuerpo `{ "role": "user" | "admin" }`. Devuelve el usuario actualizado. Errores: 400 rol inválido, 404 usuario inexistente y 409 `last_admin`. |

Las listas van dentro de un objeto (`{ "assets": [...] }`) para poder agregar paginación sin romper el contrato. Las fechas con hora van en ISO UTC (`2026-11-04T19:13:07Z`) y las fechas de precios como `YYYY-MM-DD`.

Errores: `401 unauthorized`, `400 invalid_json` o `invalid_input`, `409 email_conflict`, `503 not_configured` o `database_unavailable`.

## CORS

El middleware de `backend/src/api/cors.jl` solo devuelve `Access-Control-Allow-Origin` para los orígenes de `ALLOWED_ORIGINS`:

- Origen permitido: la respuesta incluye el origen y `Vary: Origin`.
- Preflight `OPTIONS` permitido: `204` con métodos `GET, POST, OPTIONS` y encabezado `Content-Type`.
- Preflight de otro origen: `403`.
- Solicitudes sin origen (por ejemplo `curl` o servidores) se atienden normalmente.

## Límites actuales

- Los endpoints públicos de cálculo (`/api/analysis/metrics` y `/api/risk/monte-carlo`) no exigen sesión ni persisten resultados; las simulaciones persistidas asociadas a una cartera guardada (RF-47) se ejecutan a través de `POST /api/internal/portfolios/{id}/simulations`.
- Todavía no hay endpoints para optimización matemática (`JuMP`/`HiGHS`), modelos predictivos ni backtesting.
- Sin progreso de simulaciones largas (RNF-02); con los límites actuales una solicitud tarda milisegundos.

## Pruebas

- `backend/test/services/services_tests.jl`: casos de uso de análisis y Monte Carlo, y validación de límites.
- `backend/test/api/api_tests.jl`: endpoints públicos, códigos de error y CORS mediante `internalrequest` (sin abrir puertos).
- `backend/test/api/users_api_tests.jl`: rutas internas de usuarios (`/api/internal/users/google` y `/api/internal/users/{id}`).
- `backend/test/api/admin_api_tests.jl`: rutas internas de administración, control de rol y subida de CSV.
- `backend/test/api/portfolios_api_tests.jl`: rutas internas de carteras, catálogo de activos, historial de valor y conversión de moneda.
- `backend/test/api/simulations_api_tests.jl`: ejecución y listado de simulaciones persistidas por cartera.
- `backend/test/runtests.jl`: además de las suites por capa, verifica que `precompile_workload` ejercite todas las rutas principales sin dejar estado residual.

```bash
julia --project=backend backend/test/runtests.jl
```

## Resumen y exportación (B8, RF-54 a RF-58)

Enviar `X-Internal-Key` y `X-Actor-User-Id` con el UUID del usuario. También se acepta
`X-Actor-Id` para el transporte interno existente. Si llegan los dos, deben indicar el
mismo usuario. No se acepta elegir al actor mediante query o body.

| Método y ruta | Entrada | Respuesta |
|---|---|---|
| `GET /api/internal/reports/summary` | Query `limit` opcional: entero 1–50 (20 si se omite). Sin cuerpo. | **200** JSON, ejecuciones propias más recientes primero (lista vacía si no hay resultados). |
| `GET /api/internal/reports/{id}/export?format=csv` | `id` exacto del resumen (`kind:UUID`); el único formato es `csv`, predeterminado. Sin cuerpo. | **200** `text/csv; charset=utf-8`, adjunto `report.csv`. |

El resumen devuelve:

- `reports: [{ id, kind, module_code, title, subject, period_from, period_to, calculated_at,
  origin, freshness, frequency, currency, source, model, parameters, metrics }]`.
  `kind` identifica `simulation` (F2), `optimization` (F4), `prediction` (F5) o
  `backtest` (F6). `model` es el identificador guardado; `parameters` conserva los parámetros
  principales de cada ejecución. Las fechas efectivas son ISO, `calculated_at` está en UTC.
- `source: { storage: "postgresql", price_method: "adjusted_close_or_close", ingestion: null }`.
  `origin` es `"api"`, `frequency` es `"daily_sessions"` y `freshness` es `"unknown"`: el
  historial no acredita la fuente original por sesión (API o CSV), ni la vigencia actual.
  `currency` y los campos de ventana pueden ser `null` si no se guardaron.
- `metrics: [{ id, label, unit, value }]`; `unit` es `"fraction"` o `"ratio"`.
  `value` es numérico o `null` si no se puede calcular. Los resultados de predicción
  se refieren a la métrica guardada; los de backtesting, a la ventana de evaluación.
- `formulas: [{ id, name, unit, formula, interpretation, assumptions }]`; `id` enlaza
  con `metrics[].id`. `export_capabilities: { csv_available, expected_columns }` y
  `covered_kinds` indican los resultados disponibles.

El CSV tiene una fila por métrica del mismo registro visible, en el mismo orden del resumen:
`id,kind,title,subject,period_from,period_to,calculated_at,currency,model,storage,price_method,metric_id,metric_label,unit,value`.
Los valores nulos quedan vacíos; los textos se escapan y un texto con inicio interpretable
como fórmula se marca con `text: `. Los números negativos se conservan como números.

El análisis multiactivo y el estrés sin persistencia no aparecen en el historial. Ambas
respuestas exitosas incluyen `Cache-Control: private, no-store`.

| HTTP | Error |
|---|---|
| 400 | `invalid_input`: formato o límite inválido, o encabezados de actor en conflicto. |
| 401 / 403 | `unauthorized` (clave inválida) o `forbidden` (actor inválido o ausente). |
| 404 | `not_found`: ID de reporte inexistente, inválido o de otro usuario. |
| 503 | `not_configured` o `database_unavailable`. |

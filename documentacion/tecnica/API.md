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
| `DATABASE_URL` | vacío | PostgreSQL para las rutas de usuarios. Sin ella, esas rutas responden 503. |
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
| 409 | `email_conflict` | El correo ya pertenece a otra cuenta de Google. |
| 422 | `insufficient_data` | No hay observaciones suficientes para el cálculo (RF-20). |
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
{ "id": "68c8f646-e505-432b-b856-396f04580976", "email": "ana@example.com", "display_name": "Ana López" }
```

Errores: `401 unauthorized`, `400 invalid_json` o `invalid_input`, `409 email_conflict`, `503 not_configured` o `database_unavailable`.

## CORS

El middleware de `backend/src/api/cors.jl` solo devuelve `Access-Control-Allow-Origin` para los orígenes de `ALLOWED_ORIGINS`:

- Origen permitido: la respuesta incluye el origen y `Vary: Origin`.
- Preflight `OPTIONS` permitido: `204` con métodos `GET, POST, OPTIONS` y encabezado `Content-Type`.
- Preflight de otro origen: `403`.
- Solicitudes sin origen (por ejemplo `curl` o servidores) se atienden normalmente.

## Límites actuales

- Los endpoints de cálculo no exigen sesión; los usuarios por ahora solo se guardan al iniciar sesión.
- Sin persistencia: los resultados no se guardan (RF-47 queda para la base de datos).
- Sin carga de CSV por HTTP ni consulta de activos; el importador existe en `infrastructure/` y se expondrá en un próximo paso.
- Sin progreso de simulaciones largas (RNF-02); con los límites actuales una solicitud tarda milisegundos.

## Pruebas

- `backend/test/services/services_tests.jl`: casos de uso y validación de límites.
- `backend/test/api/api_tests.jl`: cada endpoint, cada código de error y CORS, mediante `internalrequest` (sin abrir puertos).
- `backend/test/api/users_api_tests.jl`: la ruta interna de usuarios (clave, configuración, alta, actualización y errores).

```bash
julia --project=backend backend/test/runtests.jl
```

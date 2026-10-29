# API

## Overview

Responsabilidad: traducir solicitudes HTTP/JSON a operaciones del backend y devolver respuestas.

Contenido permitido: rutas, contratos de entrada/salida y validación de transporte. Límite: no calcular reglas financieras ni acceder directamente a PostgreSQL; esas tareas corresponden al dominio y a infraestructura.

Dentro de este módulo, `get` es el verbo de rutas de Oxygen; para diccionarios use `Base.get`. Contrato completo en [`API.md`](../../../documentacion/tecnica/API.md).

## Interface

- **Submodule & Server Lifecycle (`Api.jl`)**:
  - `MarkovLabBackend.Api` (`[Api.jl:Api]`): Submódulo con instancia propia de Oxygen (`@oxidize`).
  - `configure!(; users::Union{Nothing,UserRepository}, internal_key::AbstractString)` (`[Api.jl:configure!]`): Fija el repositorio de usuarios y la clave interna esperada (`X-Internal-Key`).
  - `start(; host, port, allowed_origins, async=false)` (`[Api.jl:start]`): Inicia el servidor HTTP leyendo la configuración desde variables de entorno.
  - Constantes: `SERVICE_NAME` (`"markovlab-backend"`), `DEFAULT_ALLOWED_ORIGINS` (`"http://localhost:3000"`), `MIN_INTERNAL_KEY_LENGTH` (`32`) (`[Api.jl:SERVICE_NAME]`, `[Api.jl:DEFAULT_ALLOWED_ORIGINS]`, `[Api.jl:MIN_INTERNAL_KEY_LENGTH]`).
- **HTTP Routes (`routes.jl`)**:
  - `GET /health` (`[routes.jl:get("/health")]`): Devuelve estado, nombre del servicio y versión del paquete.
  - `POST /api/analysis/metrics` (`[routes.jl:post("/api/analysis/metrics")]`): Calcula métricas financieras principales llamando a `analyze_prices`.
  - `POST /api/internal/users/google` (`[routes.jl:post("/api/internal/users/google")]`): Ruta interna protegida por `X-Internal-Key` que sincroniza un `GoogleProfile` mediante `sync_google_user`.
  - `POST /api/risk/monte-carlo` (`[routes.jl:post("/api/risk/monte-carlo")]`): Ejecuta la simulación Monte Carlo de una cartera llamando a `run_monte_carlo`.
- **Validation & Error Translation (`errors.jl`)**:
  - `RequestError(status, code, message)` (`[errors.jl:RequestError]`), `handle(f, req)` (`[errors.jl:handle]`), `error_response(err)` (`[errors.jl:error_response]`).
  - Lectura y validación de JSON: `parse_body(req)`, `required_field(object, name)`, `optional_field(object, name, default)`, `number_value(value, name)`, `integer_value(value, name)`, `string_value(value, name)`, `number_vector(value, name)`, `optional_string(object, name)`, `optional_number(object, name)`, `optional_integer(object, name)` (`[errors.jl:parse_body]`, `[errors.jl:required_field]`, `[errors.jl:optional_field]`, `[errors.jl:number_value]`, `[errors.jl:integer_value]`, `[errors.jl:string_value]`, `[errors.jl:number_vector]`, `[errors.jl:optional_string]`, `[errors.jl:optional_number]`, `[errors.jl:optional_integer]`).
  - Seguridad de rutas internas: `secure_equals(expected, given)` (`[errors.jl:secure_equals]`), `require_internal_key(req)` (`[errors.jl:require_internal_key]`), `configured_users()` (`[errors.jl:configured_users]`).
- **CORS (`cors.jl`)**:
  - `parse_allowed_origins(value)` (`[cors.jl:parse_allowed_origins]`), `cors_middleware(allowed_origins)` (`[cors.jl:cors_middleware]`), `CORS_ALLOWED_METHODS`, `CORS_ALLOWED_HEADERS` (`[cors.jl:CORS_ALLOWED_METHODS]`, `[cors.jl:CORS_ALLOWED_HEADERS]`).

## Invariants

- Las rutas traducen solicitudes en llamadas a servicios y excepciones en respuestas JSON sin calcular reglas financieras ni consultar PostgreSQL directamente (`[Api.jl:Api]`).
- Si `INTERNAL_API_KEY` tiene menos de `MIN_INTERNAL_KEY_LENGTH` (`32`) caracteres al iniciar, se descarta con advertencia y las rutas internas permanecen deshabilitadas (`503 not_configured`) (`[Api.jl:MIN_INTERNAL_KEY_LENGTH]`, `[Api.jl:start]`, `[errors.jl:require_internal_key]`).
- `POST /api/internal/users/google` verifica `X-Internal-Key` en tiempo constante con `secure_equals` antes de leer el cuerpo JSON, respondiendo `503` si no está configurado y `401` si la clave falta o no coincide (`[routes.jl:post("/api/internal/users/google")]`, `[errors.jl:secure_equals]`, `[errors.jl:require_internal_key]`).
- `parse_body` exige un objeto JSON válido (`400 invalid_json` / `400 invalid_input`), los validadores numéricos rechazan valores `Bool` (`[errors.jl:parse_body]`, `[errors.jl:is_number]`, `[errors.jl:integer_value]`), y `error_response` traduce `InsufficientDataError` a `422`, `ArgumentError` a `400`, `EmailConflictError` a `409`, `LibPQException` a `503` (sin exponer detalles internos al cliente) y errores no controlados a `500` (`[errors.jl:error_response]`).
- `cors_middleware` responde `204` a solicitudes `OPTIONS` únicamente cuando `Origin` pertenece a `allowed_origins` (o `"*"`) y `403` en caso contrario (`[cors.jl:cors_middleware]`).
- Dentro de `Api`, `@oxidize` define `get` para rutas HTTP; el acceso a diccionarios debe usar `Base.get` (`[Api.jl:@oxidize]`, `[errors.jl:optional_field]`).

## Side Effects

- Modifica las referencias globales del módulo `USERS` e `INTERNAL_KEY` mediante `configure!` (`[Api.jl:USERS]`, `[Api.jl:INTERNAL_KEY]`, `[Api.jl:configure!]`).
- Lee `HOST`, `PORT`, `ALLOWED_ORIGINS`, `DATABASE_URL` e `INTERNAL_API_KEY` desde `ENV`, instancia `PostgresUserRepository` cuando `DATABASE_URL` no está vacío, registra eventos en el log del servidor y abre el servidor HTTP con `serve` (`[Api.jl:start]`, `[errors.jl:error_response]`).

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

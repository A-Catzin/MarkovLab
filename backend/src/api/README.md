# API

## Overview

Responsabilidad: traducir solicitudes HTTP/JSON a operaciones del backend y devolver respuestas.

Contenido permitido: rutas, contratos de entrada/salida y validación de transporte. Límite: no calcular reglas financieras ni acceder directamente a PostgreSQL; esas tareas corresponden al dominio, a servicios y a infraestructura.

Dentro de este módulo, `get` es el verbo de rutas de Oxygen; para diccionarios use `Base.get`. Contrato completo en [`API.md`](../../../documentacion/tecnica/API.md).

## Interface

- **Submódulo y ciclo de vida (`Api.jl`)**:
  - `MarkovLabBackend.Api` (`[Api.jl:Api]`): Submódulo con instancia propia de Oxygen (`@oxidize`).
  - `configure!(; users::Union{Nothing,UserRepository}, prices::Union{Nothing,PriceRepository}=nothing, portfolios::Union{Nothing,PortfolioRepository}=nothing, simulations::Union{Nothing,SimulationRepository}=nothing, internal_key::AbstractString)` (`[Api.jl:configure!]`): Fija los repositorios y la clave interna esperada (`X-Internal-Key`).
  - `warm_database(users, prices, portfolios, simulations)` (`[Api.jl:warm_database]`): Ejecuta lecturas de solo lectura al arrancar para precompilar los adaptadores de PostgreSQL antes de la primera petición real.
  - `start(; host, port, allowed_origins, async=false)` (`[Api.jl:start]`): Inicia el servidor HTTP leyendo la configuración desde variables de entorno.
  - Constantes: `SERVICE_NAME` (`"markovlab-backend"`), `DEFAULT_ALLOWED_ORIGINS` (`"http://localhost:3000"`), `MIN_INTERNAL_KEY_LENGTH` (`32`) (`[Api.jl:SERVICE_NAME]`, `[Api.jl:DEFAULT_ALLOWED_ORIGINS]`, `[Api.jl:MIN_INTERNAL_KEY_LENGTH]`).
- **Rutas HTTP (`routes.jl`, 17 endpoints)**:
  - Públicas:
    - `GET /health` (`[routes.jl:get("/health")]`): Estado, servicio y versión del paquete.
    - `POST /api/analysis/metrics` (`[routes.jl:post("/api/analysis/metrics")]`): Métricas financieras (`analyze_prices`).
    - `POST /api/risk/monte-carlo` (`[routes.jl:post("/api/risk/monte-carlo")]`): Simulación Monte Carlo sin estado (`run_monte_carlo`).
  - Internas de autenticación (`X-Internal-Key`):
    - `POST /api/internal/users/google` (`[routes.jl:post("/api/internal/users/google")]`): Crea o actualiza un usuario verificado por Google (`sync_google_user`).
    - `GET /api/internal/users/{id}` (`[routes.jl:get("/api/internal/users/{id}")]`): Consulta el usuario y su rol actual (`find_user`).
  - Internas de usuario (`X-Internal-Key` + `X-Actor-Id`):
    - `GET /api/internal/assets` (`[routes.jl:get("/api/internal/assets")]`): Catálogo de activos con precios (`list_assets`).
    - `GET /api/internal/portfolios` (`[routes.jl:get("/api/internal/portfolios")]`): Lista las carteras del actor (`list_user_portfolios`).
    - `POST /api/internal/portfolios` (`[routes.jl:post("/api/internal/portfolios")]`): Crea una cartera (`create_user_portfolio`, responde `201`).
    - `GET /api/internal/portfolios/{id}` (`[routes.jl:get("/api/internal/portfolios/{id}")]`): Detalle de una cartera del actor (`get_user_portfolio`).
    - `GET /api/internal/portfolios/{id}/history` (`[routes.jl:get("/api/internal/portfolios/{id}/history")]`): Valor histórico diario en moneda de la cartera (`user_portfolio_history`).
    - `POST /api/internal/portfolios/{id}/simulations` (`[routes.jl:post("/api/internal/portfolios/{id}/simulations")]`): Simula una cartera guardada y persiste la corrida (`simulate_user_portfolio`, responde `201`).
    - `GET /api/internal/portfolios/{id}/simulations` (`[routes.jl:get("/api/internal/portfolios/{id}/simulations")]`): Lista las simulaciones guardadas de una cartera (`list_user_simulations`).
    - `DELETE /api/internal/portfolios/{id}` (`[routes.jl:delete("/api/internal/portfolios/{id}")]`): Elimina una cartera del actor (`delete_user_portfolio`).
  - Internas de administración (`X-Internal-Key` + `X-Actor-Id` con rol `:admin`):
    - `POST /api/internal/admin/prices/import` (`[routes.jl:post("/api/internal/admin/prices/import")]`): Importación de CSV de un activo (`import_prices`, hasta `MAX_UPLOAD_CSV_LENGTH`).
    - `GET /api/internal/admin/summary` (`[routes.jl:get("/api/internal/admin/summary")]`): Conteos globales y última importación (`admin_summary`).
    - `GET /api/internal/admin/assets` (`[routes.jl:get("/api/internal/admin/assets")]`): Catálogo completo con estadísticas de precios (`list_assets`).
    - `GET /api/internal/admin/imports` (`[routes.jl:get("/api/internal/admin/imports")]`): Últimas importaciones (`limit` de 1 a 500, por defecto 50; `list_imports`).
    - `GET /api/internal/admin/users` (`[routes.jl:get("/api/internal/admin/users")]`): Listado de usuarios y roles (`list_users`).
    - `PUT /api/internal/admin/users/{id}/role` (`[routes.jl:put("/api/internal/admin/users/{id}/role")]`): Cambia el rol de un usuario (`change_user_role`).
- **Validación, seguridad y serialización (`errors.jl`)**:
  - `RequestError(status, code, message)`, `handle(f, req)`, `error_response(err)`, `not_found(message)` (`[errors.jl:RequestError]`, `[errors.jl:handle]`, `[errors.jl:error_response]`, `[errors.jl:not_found]`).
  - Lectura de JSON: `parse_body(req)`, `required_field`, `optional_field`, `number_value`, `integer_value`, `string_value`, `number_vector`, `optional_string`, `optional_number`, `optional_integer`, `portfolio_draft` (`[errors.jl:parse_body]`, `[errors.jl:portfolio_draft]`).
  - Seguridad y dependencias: `secure_equals`, `require_internal_key`, `require_user_actor`, `require_admin_actor`, `configured_users`, `configured_prices`, `configured_portfolios`, `configured_simulations` (`[errors.jl:require_internal_key]`, `[errors.jl:require_user_actor]`, `[errors.jl:require_admin_actor]`, `[errors.jl:configured_users]`, `[errors.jl:configured_prices]`, `[errors.jl:configured_portfolios]`, `[errors.jl:configured_simulations]`).
  - Constantes y serializadores JSON: `MAX_UPLOAD_CSV_LENGTH` (`5_000_000`), `MAX_REPORTED_ISSUES` (`20`), `asset_json`, `portfolio_json`, `user_json`, `simulation_json` (`[errors.jl:MAX_UPLOAD_CSV_LENGTH]`, `[errors.jl:MAX_REPORTED_ISSUES]`, `[errors.jl:asset_json]`, `[errors.jl:portfolio_json]`, `[errors.jl:user_json]`, `[errors.jl:simulation_json]`).
- **CORS (`cors.jl`)**:
  - `parse_allowed_origins(value)`, `cors_middleware(allowed_origins)`, `CORS_ALLOWED_METHODS`, `CORS_ALLOWED_HEADERS` (`[cors.jl:parse_allowed_origins]`, `[cors.jl:cors_middleware]`, `[cors.jl:CORS_ALLOWED_METHODS]`, `[cors.jl:CORS_ALLOWED_HEADERS]`).

## Invariants

- Las rutas traducen solicitudes en llamadas a servicios y excepciones en respuestas JSON sin calcular reglas financieras ni consultar PostgreSQL directamente (`[Api.jl:Api]`).
- Si `INTERNAL_API_KEY` tiene menos de `MIN_INTERNAL_KEY_LENGTH` (`32`) caracteres al iniciar, se descarta con advertencia y las rutas internas permanecen deshabilitadas (`503 not_configured`) (`[Api.jl:MIN_INTERNAL_KEY_LENGTH]`, `[Api.jl:start]`, `[errors.jl:require_internal_key]`).
- Todas las rutas bajo `/api/internal/*` verifican `X-Internal-Key` en tiempo constante con `secure_equals` antes de leer el cuerpo o consultar la base (`[errors.jl:require_internal_key]`, `[errors.jl:secure_equals]`). Las rutas de usuario validan `X-Actor-Id` con `require_user_actor`; las de admin exigen además rol `:admin` en PostgreSQL mediante `require_admin_actor` (`[errors.jl:require_user_actor]`, `[errors.jl:require_admin_actor]`).
- `parse_body` exige un objeto JSON válido (`400 invalid_json` / `400 invalid_input`), los validadores numéricos rechazan valores `Bool` (`[errors.jl:parse_body]`, `[errors.jl:is_number]`, `[errors.jl:integer_value]`), y `error_response` traduce `InsufficientDataError` y `MissingExchangeRateError` a `422`, `ArgumentError` a `400`, `ForbiddenError` a `403`, `EmailConflictError` y `LastAdminError` a `409`, `LibPQException` a `503` (sin exponer detalles internos al cliente) y errores no controlados a `500` (`[errors.jl:error_response]`).
- `cors_middleware` responde `204` a solicitudes `OPTIONS` únicamente cuando `Origin` pertenece a `allowed_origins` (o `"*"`) y `403` en caso contrario (`[cors.jl:cors_middleware]`).
- Dentro de `Api`, `@oxidize` define `get` para rutas HTTP; el acceso a diccionarios debe usar `Base.get` (`[Api.jl:@oxidize]`, `[errors.jl:optional_field]`).

## Side Effects

- Modifica las referencias globales del módulo `USERS`, `PRICES`, `PORTFOLIOS`, `SIMULATIONS` e `INTERNAL_KEY` mediante `configure!` (`[Api.jl:USERS]`, `[Api.jl:PRICES]`, `[Api.jl:PORTFOLIOS]`, `[Api.jl:SIMULATIONS]`, `[Api.jl:INTERNAL_KEY]`, `[Api.jl:configure!]`).
- `start()` lee `HOST`, `PORT`, `ALLOWED_ORIGINS`, `DATABASE_URL` e `INTERNAL_API_KEY` desde `ENV`, instancia los cuatro repositorios PostgreSQL cuando `DATABASE_URL` está configurada, lanza una tarea en segundo plano (`Threads.@spawn`) para ejecutar `SELECT 1` y `warm_database(...)` (solo lectura) registrando `"Database connection ready"` / `"Database routes warmed up"`, y abre el servidor HTTP con `serve` (`[Api.jl:start]`, `[Api.jl:warm_database]`).

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

# Utilidades para leer solicitudes y traducir errores en respuestas JSON.

"""Error detectado al leer una solicitud; lleva el estado HTTP y el código de error."""
struct RequestError <: Exception
    status::Int
    code::String
    message::String
end

invalid_input(message) = RequestError(400, "invalid_input", message)

error_body(code, message) = Dict("error" => code, "message" => message)

error_response(err::RequestError) = json(error_body(err.code, err.message); status=err.status)
error_response(err::InsufficientDataError) =
    json(error_body("insufficient_data", sprint(showerror, err)); status=422)
error_response(err::ArgumentError) = json(error_body("invalid_input", err.msg); status=400)
error_response(err::ForbiddenError) = json(error_body("forbidden", err.message); status=403)
error_response(::LastAdminError) =
    json(error_body("last_admin", "the last admin cannot lose the admin role"); status=409)
error_response(err::EmailConflictError) =
    json(error_body("email_conflict", "the email belongs to another account"); status=409)
# Una falla de la base no expone detalles al cliente; el detalle queda en el registro del servidor.
function error_response(err::LibPQ.Errors.LibPQException)
    @error "Database error" exception = (err, catch_backtrace())
    return json(error_body("database_unavailable", "the database is not available"); status=503)
end
function error_response(err)
    @error "Unhandled API error" exception = (err, catch_backtrace())
    return json(error_body("internal_error", "unexpected server error"); status=500)
end

"""
    handle(f, req)

Ejecuta el cuerpo de una ruta y convierte cualquier excepción en una respuesta de error JSON.
"""
function handle(f, req)
    try
        return f(req)
    catch err
        return error_response(err)
    end
end

function parse_body(req)
    body = try
        json(req)
    catch
        throw(RequestError(400, "invalid_json", "request body must be valid JSON"))
    end
    body isa AbstractDict || throw(invalid_input("request body must be a JSON object"))
    return body
end

function required_field(object, name)
    object isa AbstractDict || throw(invalid_input("expected a JSON object containing \"$name\""))
    haskey(object, name) || throw(invalid_input("missing field \"$name\""))
    return object[name]
end

# `Base.get` es explícito porque `@oxidize` define una función de ruta `get` en este módulo.
optional_field(object, name, default) = something(Base.get(object, name, nothing), Some(default))

is_number(value) = value isa Real && !(value isa Bool)

function number_value(value, name)
    is_number(value) || throw(invalid_input("\"$name\" must be a number"))
    return Float64(value)
end

function integer_value(value, name)
    # Un entero fuera de Int64 (por ejemplo 10²³) también es entrada inválida, no un error interno.
    (value isa Integer && !(value isa Bool) && typemin(Int) <= value <= typemax(Int)) ||
        throw(invalid_input("\"$name\" must be an integer"))
    return Int(value)
end

function string_value(value, name)
    value isa AbstractString || throw(invalid_input("\"$name\" must be a string"))
    return String(value)
end

function number_vector(value, name)
    (value isa AbstractVector && all(is_number, value)) ||
        throw(invalid_input("\"$name\" must be an array of numbers"))
    return Float64.(value)
end

optional_string(object, name) = (value = optional_field(object, name, nothing);
                                 value === nothing ? nothing : string_value(value, name))

"""
    secure_equals(expected, given)

Compara dos claves en tiempo que no depende de dónde difieren: recorre siempre toda
la clave esperada, para no filtrar por tiempo cuántos caracteres coinciden.
"""
function secure_equals(expected::AbstractString, given::AbstractString)
    a, b = codeunits(expected), codeunits(given)
    diff = UInt(length(a) ⊻ length(b))
    for i in eachindex(a)
        diff |= a[i] ⊻ (i <= length(b) ? b[i] : 0x00)
    end
    return diff == 0
end

"""
    require_internal_key(req)

Exige el encabezado `X-Internal-Key` de las rutas internas. Responde 503 si las rutas
internas no están configuradas y 401 si la clave falta o no coincide.
"""
function require_internal_key(req)
    expected = INTERNAL_KEY[]
    isempty(expected) && throw(RequestError(503, "not_configured", "internal routes are not configured"))
    given = HTTP.header(req, "X-Internal-Key", "")
    secure_equals(expected, given) || throw(RequestError(401, "unauthorized", "missing or invalid internal key"))
    return nothing
end

function configured_portfolios()
    portfolios = PORTFOLIOS[]
    portfolios === nothing && throw(RequestError(503, "not_configured", "the database is not configured"))
    return portfolios
end

"""Actor de las rutas de usuario: el id de `X-Actor-Id` debe existir en la base (403 si no)."""
require_user_actor(req, users) = require_user(users, HTTP.header(req, "X-Actor-Id", nothing))

asset_json(a) = Dict("id" => a.id, "symbol" => a.symbol, "name" => a.name, "market" => a.market,
                     "category" => a.category, "currency" => a.currency, "last_synced_at" => iso(a.last_synced_at),
                     "price_rows" => a.price_rows, "first_date" => iso(a.first_date), "last_date" => iso(a.last_date))

portfolio_json(p::SavedPortfolio) = Dict(
    "id" => p.id, "name" => p.name, "capital" => p.capital, "currency" => p.currency,
    "start_date" => p.start_date, "status" => String(p.status), "created_at" => p.created_at,
    "positions" => [Dict("asset_id" => x.asset_id, "symbol" => x.symbol, "market" => x.market,
                         "name" => x.name, "weight" => x.weight) for x in p.positions])

"""Lee el cuerpo de `POST /api/internal/portfolios` y lo valida como `PortfolioDraft`."""
function portfolio_draft(body)
    positions = required_field(body, "positions")
    positions isa AbstractVector || throw(invalid_input("\"positions\" must be an array"))
    drafts = [PositionDraft(integer_value(required_field(p, "asset_id"), "asset_id"),
                            number_value(required_field(p, "weight"), "weight")) for p in positions]
    return PortfolioDraft(string_value(required_field(body, "name"), "name"),
                          number_value(required_field(body, "capital"), "capital"),
                          string_value(required_field(body, "currency"), "currency"), drafts)
end

# Tope del CSV que se puede subir desde /admin (en caracteres): unos 20 años de datos diarios caben de sobra.
const MAX_UPLOAD_CSV_LENGTH = 5_000_000
# Cuántas filas inválidas se devuelven con detalle; el total va aparte.
const MAX_REPORTED_ISSUES = 20

function configured_prices()
    prices = PRICES[]
    prices === nothing && throw(RequestError(503, "not_configured", "the database is not configured"))
    return prices
end

not_found(message) = RequestError(404, "not_found", message)

"""
    require_admin_actor(req, users) -> AppUser

Exige el encabezado `X-Actor-Id` con el id del usuario que navega en Next.js, y que ese
usuario sea admin según la base (no según su token). Responde 403 si falta o no es admin.
"""
require_admin_actor(req, users) = require_admin(users, HTTP.header(req, "X-Actor-Id", nothing))

"""Rol de la API (`"user"`, `"admin"`) a partir del símbolo del dominio."""
role_value(role::Symbol) = String(role)

user_json(user::AppUser) =
    Dict("id" => user.id, "email" => user.email, "display_name" => user.display_name, "role" => role_value(user.role))

# Las fechas viajan como texto ISO; `nothing` queda como null.
iso(value) = value === nothing ? nothing : string(value)

function configured_users()
    users = USERS[]
    users === nothing && throw(RequestError(503, "not_configured", "the database is not configured"))
    return users
end

optional_number(object, name) = (value = optional_field(object, name, nothing);
                                 value === nothing ? nothing : number_value(value, name))
optional_integer(object, name) = (value = optional_field(object, name, nothing);
                                  value === nothing ? nothing : integer_value(value, name))

function configured_simulations()
    simulations = SIMULATIONS[]
    simulations === nothing && throw(RequestError(503, "not_configured", "the database is not configured"))
    return simulations
end

simulation_json(s::SavedSimulation) = Dict(
    "id" => s.id, "portfolio_id" => s.portfolio_id, "model" => s.model, "simulations" => s.simulations,
    "horizon" => s.horizon, "confidence" => s.confidence, "seed" => s.seed, "observations" => s.observations,
    "symbols" => s.symbols, "weights" => s.weights,
    "window" => Dict("from" => string(s.window[1]), "to" => string(s.window[2])),
    "expected_return" => s.expected_return, "expected_volatility" => s.expected_volatility,
    "value_at_risk" => s.value_at_risk, "conditional_value_at_risk" => s.conditional_value_at_risk,
    "summary" => s.summary, "created_at" => s.created_at)

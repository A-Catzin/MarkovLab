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
    (value isa Integer && !(value isa Bool)) || throw(invalid_input("\"$name\" must be an integer"))
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

function configured_users()
    users = USERS[]
    users === nothing && throw(RequestError(503, "not_configured", "the database is not configured"))
    return users
end

optional_number(object, name) = (value = optional_field(object, name, nothing);
                                 value === nothing ? nothing : number_value(value, name))
optional_integer(object, name) = (value = optional_field(object, name, nothing);
                                  value === nothing ? nothing : integer_value(value, name))

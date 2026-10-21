# Request parsing helpers and translation of errors into JSON responses.

"""Error detected while reading a request; carries the HTTP status and code."""
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
function error_response(err)
    @error "Unhandled API error" exception = (err, catch_backtrace())
    return json(error_body("internal_error", "unexpected server error"); status=500)
end

"""
    handle(f, req)

Runs a route body and converts any exception into a JSON error response.
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

# `Base.get` is explicit because `@oxidize` defines a `get` route function in this module.
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

optional_number(object, name) = (value = optional_field(object, name, nothing);
                                 value === nothing ? nothing : number_value(value, name))
optional_integer(object, name) = (value = optional_field(object, name, nothing);
                                  value === nothing ? nothing : integer_value(value, name))

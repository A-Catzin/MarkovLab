# CORS middleware restricted to a list of origins (ALLOWED_ORIGINS, SRS 6.5).

const CORS_ALLOWED_METHODS = "GET, POST, OPTIONS"
const CORS_ALLOWED_HEADERS = "Content-Type"

"""
    parse_allowed_origins(value) -> Vector{String}

Splits a comma-separated list of origins, trimming spaces and dropping empty entries.
"""
parse_allowed_origins(value::AbstractString) =
    [String(strip(origin)) for origin in split(value, ',') if !isempty(strip(origin))]

"""
    cors_middleware(allowed_origins)

Middleware that echoes `Access-Control-Allow-Origin` only for origins in the
list (`"*"` allows any origin). Preflight `OPTIONS` requests get `204` when the
origin is allowed and `403` otherwise. Requests from other origins are still
served, but without CORS headers, so browsers block them.
"""
function cors_middleware(allowed_origins::AbstractVector{<:AbstractString})
    allowed = Set{String}(allowed_origins)
    allow_any = "*" in allowed
    return function (handler)
        return function (req::HTTP.Request)
            origin = HTTP.header(req, "Origin")
            permitted = !isempty(origin) && (allow_any || origin in allowed)
            if req.method == "OPTIONS"
                permitted || return HTTP.Response(403)
                return HTTP.Response(204, ["Access-Control-Allow-Origin" => origin,
                                           "Access-Control-Allow-Methods" => CORS_ALLOWED_METHODS,
                                           "Access-Control-Allow-Headers" => CORS_ALLOWED_HEADERS,
                                           "Vary" => "Origin"])
            end
            response = handler(req)
            if permitted
                HTTP.setheader(response, "Access-Control-Allow-Origin" => origin)
                HTTP.setheader(response, "Vary" => "Origin")
            end
            return response
        end
    end
end

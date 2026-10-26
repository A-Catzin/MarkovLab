# Middleware CORS restringido a una lista de orígenes (ALLOWED_ORIGINS, SRS 6.5).

const CORS_ALLOWED_METHODS = "GET, POST, OPTIONS"
const CORS_ALLOWED_HEADERS = "Content-Type"

"""
    parse_allowed_origins(value) -> Vector{String}

Divide una lista de orígenes separados por comas, quitando espacios y entradas vacías.
"""
parse_allowed_origins(value::AbstractString) =
    [String(strip(origin)) for origin in split(value, ',') if !isempty(strip(origin))]

"""
    cors_middleware(allowed_origins)

Middleware que devuelve `Access-Control-Allow-Origin` solo para los orígenes de
la lista (`"*"` permite cualquiera). Las solicitudes previas `OPTIONS` reciben
`204` si el origen está permitido y `403` si no. Las solicitudes de otros
orígenes se atienden igual, pero sin encabezados CORS, así que el navegador las bloquea.
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

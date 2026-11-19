# Carga de trabajo de precompilación: recorre una vez las rutas principales con datos en
# memoria mientras se precompila el paquete (al construir la imagen de Docker), para que
# el código compilado quede guardado en la imagen. Sin esto, la primera petición a cada
# ruta se compila en el momento: 2 a 3 s en una máquina de desarrollo (medido el
# 2026-11-19), más en un servidor compartido, y la página de una cartera pide tres a la vez
# contra un límite de 10 s del frontend.

"""
    precompile_workload() -> Vector{Pair{String,Int}}

Recorre las rutas internas con repositorios en memoria (un activo en USD, otro en MXN y su
tipo de cambio, para compilar también la conversión) y devuelve la ruta y el código de
cada respuesta. Deja la API sin configurar al terminar, aunque algo falle: el estado de la
precompilación queda guardado en la imagen.
"""
function precompile_workload()
    users = InMemoryUserRepository()
    prices = InMemoryPriceRepository()
    portfolios = InMemoryPortfolioRepository(prices)
    simulations = InMemorySimulationRepository()
    days = [d for d in Date(2024, 1, 1):Day(1):Date(2024, 6, 28) if dayofweek(d) <= 5]
    ids = Int[]
    for (symbol, currency, drift) in (("PRE", "USD", 0.001), ("PRE.MX", "MXN", 0.0005))
        closes = [100 * (1 + drift)^i * (1 + 0.01 * sin(i)) for i in eachindex(days)]
        bars = [PriceBar(symbol, d, c, c * 1.01, c * 0.99, c, 1000, c) for (d, c) in zip(days, closes)]
        details = AssetDetails(symbol, currency == "USD" ? "NASDAQ" : "BMV", "Acción", currency)
        push!(ids, first(save_price_import(prices, symbol, details, bars, :success, 0, nothing; source=:api)))
    end
    save_exchange_rates(prices, "MXN", [(d, 18 + 0.2 * sin(i)) for (i, d) in enumerate(days)])
    user = sync_google_user(users, GoogleProfile("precompile", "precompile@example.com", "Precompile"))

    key = "p"^Api.MIN_INTERNAL_KEY_LENGTH
    headers = ["X-Internal-Key" => key, "X-Actor-Id" => user.id]
    statuses = Pair{String,Int}[]
    function call(method, path, body=nothing)
        request = body === nothing ? HTTP.Request(method, path, headers) :
                  HTTP.Request(method, path, ["Content-Type" => "application/json"; headers], body)
        response = Api.internalrequest(request)
        push!(statuses, "$method $path" => response.status)
        return response
    end

    Api.configure!(; users, prices, portfolios, simulations, internal_key=key)
    try
        call("GET", "/health")
        call("GET", "/api/internal/users/$(user.id)")
        call("GET", "/api/internal/assets")
        draft = JSON.json(Dict("name" => "Precompilación", "capital" => 10_000, "currency" => "MXN",
                               "positions" => [Dict("asset_id" => id, "weight" => 0.5) for id in ids]))
        created = JSON.parse(String(call("POST", "/api/internal/portfolios", draft).body))
        id = created["id"]
        call("GET", "/api/internal/portfolios")
        call("GET", "/api/internal/portfolios/$id")
        call("GET", "/api/internal/portfolios/$id/history")
        call("POST", "/api/internal/portfolios/$id/simulations", JSON.json(Dict("horizon" => 21, "simulations" => 1_000)))
        call("GET", "/api/internal/portfolios/$id/simulations")
    finally
        Api.configure!(; users=nothing, internal_key="")
    end
    return statuses
end

# Solo al precompilar (`jl_generating_output`), nunca al cargar el paquete en el servidor.
# Un fallo aquí no debe impedir construir la imagen: se avisa y el servidor arranca igual,
# solo que sin el código precompilado. Las pruebas corren `precompile_workload` y exigen
# que todas las rutas respondan bien.
if ccall(:jl_generating_output, Cint, ()) == 1
    try
        precompile_workload()
    catch err
        @warn "Precompile workload failed; the first requests will compile at runtime" exception = err
    end
end

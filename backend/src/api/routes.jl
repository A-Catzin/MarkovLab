# Definición de rutas. Cada ruta lee su cuerpo JSON, llama a un servicio y
# devuelve el resultado como JSON.

get("/health") do req
    json(Dict("status" => "ok", "service" => SERVICE_NAME,
              "version" => string(pkgversion(MarkovLabBackend))))
end

post("/api/analysis/metrics") do req
    handle(req) do req
        body = parse_body(req)
        prices = number_vector(required_field(body, "prices"), "prices")
        periods_per_year = optional_number(body, "periods_per_year")
        json(analyze_prices(prices; periods_per_year))
    end
end

# Ruta interna: solo la llama el servidor de Next.js (Auth.js) cuando alguien entra con
# Google. La clave se revisa antes de leer el cuerpo.
post("/api/internal/users/google") do req
    handle(req) do req
        require_internal_key(req)
        users = configured_users()
        body = parse_body(req)
        profile = GoogleProfile(string_value(required_field(body, "google_sub"), "google_sub"),
                                string_value(required_field(body, "email"), "email"),
                                optional_string(body, "name"))
        json(user_json(sync_google_user(users, profile)))
    end
end

# Ruta interna: Next.js la usa para refrescar el rol de la sesión.
get("/api/internal/users/{id}") do req, id
    handle(req) do req
        require_internal_key(req)
        user = find_user(configured_users(), id)
        user === nothing && throw(not_found("user not found"))
        json(user_json(user))
    end
end

# Rutas de admin: además de la clave interna, `X-Actor-Id` debe ser un admin según la base.
get("/api/internal/admin/summary") do req
    handle(req) do req
        require_internal_key(req)
        users = configured_users()
        require_admin_actor(req, users)
        summary = admin_summary(users, configured_prices())
        last = summary.last_import
        json(Dict("users" => summary.users, "admins" => summary.admins, "assets" => summary.assets,
                  "price_rows" => summary.price_rows,
                  "last_import" => last === nothing ? nothing :
                      Dict("status" => String(last.status), "asset_symbol" => last.asset_symbol,
                           "saved" => last.saved, "failed" => last.failed, "started_at" => iso(last.started_at))))
    end
end

get("/api/internal/admin/assets") do req
    handle(req) do req
        require_internal_key(req)
        require_admin_actor(req, configured_users())
        # Las listas van dentro de un objeto: deja lugar para paginación sin romper el contrato.
        json(Dict("assets" => [Dict("id" => a.id, "symbol" => a.symbol, "name" => a.name, "market" => a.market,
                   "category" => a.category, "currency" => a.currency, "last_synced_at" => iso(a.last_synced_at),
                   "price_rows" => a.price_rows, "first_date" => iso(a.first_date), "last_date" => iso(a.last_date))
              for a in list_assets(configured_prices())]))
    end
end

get("/api/internal/admin/imports") do req
    handle(req) do req
        require_internal_key(req)
        require_admin_actor(req, configured_users())
        raw_limit = Base.get(queryparams(req), "limit", "50")
        limit = tryparse(Int, raw_limit)
        (limit !== nothing && 1 <= limit <= 500) || throw(invalid_input("\"limit\" must be an integer between 1 and 500"))
        json(Dict("imports" => [Dict("id" => i.id, "source" => String(i.source), "status" => String(i.status),
                   "asset_symbol" => i.asset_symbol, "asset_market" => i.asset_market, "saved" => i.saved,
                   "failed" => i.failed, "message" => i.message, "started_at" => iso(i.started_at),
                   "finished_at" => iso(i.finished_at))
              for i in list_imports(configured_prices(); limit)]))
    end
end

get("/api/internal/admin/users") do req
    handle(req) do req
        require_internal_key(req)
        users = configured_users()
        require_admin_actor(req, users)
        json(Dict("users" => [user_json(user) for user in list_users(users)]))
    end
end

put("/api/internal/admin/users/{id}/role") do req, id
    handle(req) do req
        require_internal_key(req)
        users = configured_users()
        actor = require_admin_actor(req, users)
        role = parse_role(string_value(required_field(parse_body(req), "role"), "role"))
        user = change_user_role(users, actor.id, id, role)
        user === nothing && throw(not_found("user not found"))
        json(user_json(user))
    end
end

post("/api/risk/monte-carlo") do req
    handle(req) do req
        body = parse_body(req)
        assets = required_field(body, "assets")
        assets isa AbstractVector || throw(invalid_input("\"assets\" must be an array"))
        symbols = [string_value(required_field(asset, "symbol"), "symbol") for asset in assets]
        weights = [number_value(required_field(asset, "weight"), "weight") for asset in assets]
        prices = [number_vector(required_field(asset, "prices"), "prices") for asset in assets]
        seed = optional_integer(body, "seed")
        result = run_monte_carlo(Portfolio(symbols, weights), prices;
                                 simulations=something(optional_integer(body, "simulations"), DEFAULT_SIMULATIONS),
                                 horizon=something(optional_integer(body, "horizon"), DEFAULT_HORIZON),
                                 confidence=something(optional_number(body, "confidence"), DEFAULT_CONFIDENCE),
                                 seed)
        json(result)
    end
end

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

# Rutas de usuario: además de la clave interna, `X-Actor-Id` debe ser un usuario de la base.
# Cada uno ve y modifica solo sus propias carteras.
get("/api/internal/assets") do req
    handle(req) do req
        require_internal_key(req)
        require_user_actor(req, configured_users())
        json(Dict("assets" => [asset_json(a) for a in list_assets(configured_prices())]))
    end
end

get("/api/internal/portfolios") do req
    handle(req) do req
        require_internal_key(req)
        users = configured_users()
        actor = require_user_actor(req, users)
        json(Dict("portfolios" => [portfolio_json(p) for p in list_user_portfolios(users, configured_portfolios(), actor.id)]))
    end
end

post("/api/internal/portfolios") do req
    handle(req) do req
        require_internal_key(req)
        users = configured_users()
        actor = require_user_actor(req, users)
        saved = create_user_portfolio(users, configured_portfolios(), actor.id, portfolio_draft(parse_body(req)))
        json(portfolio_json(saved); status=201)
    end
end

get("/api/internal/portfolios/{id}") do req, id
    handle(req) do req
        require_internal_key(req)
        users = configured_users()
        actor = require_user_actor(req, users)
        saved = get_user_portfolio(users, configured_portfolios(), actor.id, id)
        saved === nothing && throw(not_found("portfolio not found"))
        json(portfolio_json(saved))
    end
end

delete("/api/internal/portfolios/{id}") do req, id
    handle(req) do req
        require_internal_key(req)
        users = configured_users()
        actor = require_user_actor(req, users)
        delete_user_portfolio(users, configured_portfolios(), actor.id, id) || throw(not_found("portfolio not found"))
        json(Dict("deleted" => id))
    end
end

# Subida de CSV desde /admin/importaciones: los mismos datos que backend/scripts/import_prices.jl.
post("/api/internal/admin/prices/import") do req
    handle(req) do req
        require_internal_key(req)
        require_admin_actor(req, configured_users())
        body = parse_body(req)
        csv = string_value(required_field(body, "csv"), "csv")
        isempty(strip(csv)) && throw(invalid_input("the CSV file is empty"))
        length(csv) > MAX_UPLOAD_CSV_LENGTH && throw(invalid_input("the CSV file is larger than 5 MB"))
        details = AssetDetails(string_value(required_field(body, "name"), "name"),
                               string_value(required_field(body, "market"), "market"),
                               string_value(required_field(body, "category"), "category"),
                               string_value(required_field(body, "currency"), "currency"))
        symbol = optional_string(body, "symbol")
        summary = import_prices(configured_prices(), IOBuffer(csv), details;
                                symbol=symbol === nothing || isempty(strip(symbol)) ? nothing : symbol)
        json(Dict("symbol" => summary.symbol, "asset_id" => summary.asset_id, "status" => String(summary.status),
                  "valid_rows" => summary.valid_rows, "inserted" => summary.inserted,
                  "already_stored" => summary.already_stored, "invalid_count" => length(summary.invalid),
                  "invalid" => [Dict("line" => i.line, "message" => i.message)
                                for i in Iterators.take(summary.invalid, MAX_REPORTED_ISSUES)],
                  "file_duplicates_count" => length(summary.file_duplicates)))
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
        json(Dict("assets" => [asset_json(a) for a in list_assets(configured_prices())]))
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

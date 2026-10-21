# Route definitions. Each route parses its JSON body, calls one service and
# returns its result as JSON.

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

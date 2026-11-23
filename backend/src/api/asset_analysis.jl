post("/api/internal/analysis/assets") do req
    handle(req) do req
        require_internal_key(req)
        require_user_actor(req, configured_users())
        body = parse_body(req)
        values = required_field(body, "symbols")
        values isa AbstractVector || throw(invalid_input("symbols must be an array"))
        symbols = [string_value(value, "symbol") for value in values]
        from, to = optional_iso_date(body, "from"), optional_iso_date(body, "to")
        period = something(optional_string(body, "period"), "1A")
        return_kind = something(optional_string(body, "return_kind"), "simple")
        try
            json(analyze_assets(configured_prices(), symbols; period, from, to, return_kind))
        catch err
            err isa InsufficientDataError || rethrow()
            response = Dict{String,Any}("error" => "insufficient_data",
                "message" => "the requested window has fewer than two common close sessions",
                "required_sessions" => err.required, "observed_sessions" => err.available)
            json(response; status=422)
        end
    end
end

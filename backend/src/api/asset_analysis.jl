function asset_analysis_date(body, field)
    raw = optional_string(body, field)
    raw === nothing && return nothing
    occursin(r"^\d{4}-\d{2}-\d{2}$", raw) || throw(invalid_input("$field must be a YYYY-MM-DD date"))
    parsed = tryparse(Date, raw, dateformat"yyyy-mm-dd")
    (parsed === nothing || year(parsed) < 1) && throw(invalid_input("$field must be a valid YYYY-MM-DD date"))
    return parsed
end

post("/api/internal/analysis/assets") do req
    handle(req) do req
        require_internal_key(req)
        require_user_actor(req, configured_users())
        body = parse_body(req)
        values = required_field(body, "symbols")
        values isa AbstractVector || throw(invalid_input("symbols must be an array"))
        symbols = [string_value(value, "symbol") for value in values]
        from, to = asset_analysis_date(body, "from"), asset_analysis_date(body, "to")
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

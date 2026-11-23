function configured_predictions()
    predictions = PREDICTIONS[]
    predictions === nothing && throw(RequestError(503, "not_configured", "the database is not configured"))
    return predictions
end

post("/api/internal/assets/{id}/predictions") do req, id
    handle(req) do req
        require_internal_key(req)
        actor = require_user_actor(req, configured_users())
        asset_id = tryparse(Int, id)
        (asset_id !== nothing && asset_id > 0) || throw(invalid_input("asset id must be a positive integer"))
        body = parse_body(req)
        result = MarkovLabBackend.generate_asset_prediction(configured_predictions(), configured_prices(), actor.id, asset_id;
            metric=string_value(required_field(body, "metric"), "metric"),
            horizon_days=integer_value(required_field(body, "horizon_days"), "horizon_days"),
            as_of=optional_iso_date(body, "as_of"))
        result === nothing && throw(not_found("asset not found"))
        json(result; status=201)
    end
end

get("/api/internal/predictions/{id}") do req, id
    handle(req) do req
        require_internal_key(req)
        actor = require_user_actor(req, configured_users())
        result = MarkovLabBackend.load_asset_prediction(configured_predictions(), configured_prices(), actor.id, id)
        result === nothing && throw(not_found("prediction not found"))
        json(result)
    end
end

post("/api/internal/portfolios/{id}/stress") do req, id
    handle(req) do req
        require_internal_key(req)
        users = configured_users()
        actor = require_user_actor(req, users)
        body = parse_body(req)
        result = stress_user_portfolio(users, configured_portfolios(), configured_prices(), actor.id, id;
            horizon=integer_value(required_field(body, "horizon"), "horizon"),
            simulations=something(optional_integer(body, "simulations"), DEFAULT_SIMULATIONS),
            confidence=something(optional_number(body, "confidence"), DEFAULT_CONFIDENCE),
            lookback_years=something(optional_integer(body, "lookback_years"), MarkovLabBackend.DEFAULT_LOOKBACK_YEARS),
            seed=optional_integer(body, "seed"), return_shift=something(optional_number(body, "return_shift"), 0.0),
            volatility_multiplier=something(optional_number(body, "volatility_multiplier"), 1.0),
            correlation_shift=something(optional_number(body, "correlation_shift"), 0.0))
        result === nothing && throw(not_found("portfolio not found"))
        json(result)
    end
end

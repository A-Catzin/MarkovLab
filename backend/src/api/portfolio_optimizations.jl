function optimization_bounds(body)
    raw = optional_field(body, "bounds", [])
    (raw isa AbstractVector && length(raw) <= MarkovLabBackend.MAX_PORTFOLIO_POSITIONS) ||
        throw(invalid_input("bounds must be an array of at most 50 entries"))
    return [(
        asset_id=integer_value(required_field(row, "asset_id"), "asset_id"),
        min_weight=number_value(required_field(row, "min_weight"), "min_weight"),
        max_weight=number_value(required_field(row, "max_weight"), "max_weight"),
    ) for row in raw]
end

optimization_json(row) = merge((id=row.id, created_at=row.created_at),
    (; (Symbol(k)=>v for (k,v) in pairs(row.result))...))

function error_response(err::MarkovLabBackend.OptimizationInfeasibleError)
    return json((error="optimization_infeasible", message="no portfolio satisfies the optimization constraints",
                 details=(reason=String(err.reason), minimum_volatility=err.minimum_volatility)); status=422)
end

error_response(::MarkovLabBackend.UndefinedSharpeError) =
    json(error_body("undefined_sharpe", "Sharpe cannot be calculated at the available volatility"); status=422)

function error_response(err::MarkovLabBackend.OptimizationSolverError)
    @warn "Portfolio optimizer could not certify a solution" status=err.status
    return json(error_body("optimization_unavailable", "the solver could not certify a solution"); status=503)
end

post("/api/internal/portfolios/{id}/optimizations") do req, id
    handle(req) do req
        require_internal_key(req)
        actor = require_user_actor(req, configured_users())
        body = parse_body(req)
        result = MarkovLabBackend.optimize_user_portfolio(configured_portfolios(), configured_prices(), actor.id, id;
            objective=string_value(required_field(body, "objective"), "objective"), bounds=optimization_bounds(body),
            lookback_years=something(optional_integer(body, "lookback_years"), MarkovLabBackend.DEFAULT_LOOKBACK_YEARS),
            risk_free_rate=something(optional_number(body, "risk_free_rate"), 0.0),
            max_volatility=optional_number(body, "max_volatility"))
        result === nothing && throw(not_found("portfolio not found"))
        json(optimization_json(result); status=201)
    end
end

get("/api/internal/portfolios/{id}/optimizations") do req, id
    handle(req) do req
        require_internal_key(req)
        actor = require_user_actor(req, configured_users())
        rows = MarkovLabBackend.get_optimizations(configured_portfolios(), actor.id, id)
        rows === nothing && throw(not_found("portfolio not found"))
        json((optimizations=optimization_json.(rows),))
    end
end

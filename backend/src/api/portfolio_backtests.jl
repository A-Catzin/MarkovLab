function backtest_date(body, key)
    value = optional_iso_date(body, key)
    value === nothing && throw(invalid_input("missing field \"$key\""))
    return value
end

error_response(::MarkovLabBackend.BacktestBenchmarkNotFound) = error_response(not_found("benchmark asset not found"))

post("/api/internal/portfolios/{id}/backtests") do req, id
    handle(req) do req
        require_internal_key(req)
        actor = require_user_actor(req, configured_users())
        body = parse_body(req)
        result = MarkovLabBackend.backtest_user_portfolio(configured_portfolios(), configured_prices(), actor.id, id;
            config_from=backtest_date(body, "config_from"), config_to=backtest_date(body, "config_to"),
            eval_from=backtest_date(body, "eval_from"), eval_to=backtest_date(body, "eval_to"),
            strategy=string_value(required_field(body, "strategy"), "strategy"),
            rebalance=something(optional_string(body, "rebalance"), "none"),
            transaction_cost_bps=something(optional_number(body, "transaction_cost_bps"), 0.0),
            risk_free_rate=something(optional_number(body, "risk_free_rate"), 0.0),
            benchmark_id=optional_integer(body, "benchmark_id"))
        result === nothing && throw(not_found("portfolio not found"))
        json(result; status=201)
    end
end

get("/api/internal/portfolios/{id}/backtests") do req, id
    handle(req) do req
        require_internal_key(req)
        actor = require_user_actor(req, configured_users())
        rows = MarkovLabBackend.list_backtests(configured_portfolios(), actor.id, id)
        rows === nothing && throw(not_found("portfolio not found"))
        json((backtests=rows,))
    end
end

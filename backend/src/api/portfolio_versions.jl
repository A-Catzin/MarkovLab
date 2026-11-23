put("/api/internal/portfolios/{id}") do req, id
    handle(req) do req
        require_internal_key(req)
        actor = require_user_actor(req, configured_users())
        updated = update_portfolio(configured_portfolios(), actor.id, id, portfolio_draft(parse_body(req)))
        updated === nothing && throw(not_found("portfolio not found"))
        json(portfolio_json(updated))
    end
end

post("/api/internal/portfolios/{id}/duplicate") do req, id
    handle(req) do req
        require_internal_key(req)
        actor = require_user_actor(req, configured_users())
        name = optional_string(parse_body(req), "name")
        result = duplicate_portfolio(configured_portfolios(), actor.id, id, name)
        result === nothing && throw(not_found("portfolio not found"))
        response = portfolio_json(result.portfolio)
        response["derived_from_id"] = result.source_id
        json(response; status=201)
    end
end

get("/api/internal/portfolios/{id}/versions") do req, id
    handle(req) do req
        require_internal_key(req)
        actor = require_user_actor(req, configured_users())
        versions = list_portfolio_versions(configured_portfolios(), actor.id, id)
        versions === nothing && throw(not_found("portfolio not found"))
        json(Dict("versions" => versions))
    end
end

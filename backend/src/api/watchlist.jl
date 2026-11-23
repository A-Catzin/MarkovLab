function watchlist_context(req)
    require_internal_key(req)
    actor = require_user_actor(req, configured_users())
    repo = WATCHLIST[]
    repo === nothing && throw(RequestError(503, "not_configured", "the database is not configured"))
    return repo, actor.id
end

function watchlist_asset_id(id)
    value = tryparse(Int, id)
    (value === nothing || value <= 0) && throw(invalid_input("invalid asset id"))
    return value
end

get("/api/internal/watchlist") do req
    handle(req) do req
        repo, user_id = watchlist_context(req)
        json(Dict("assets" => watched_assets(repo, user_id)))
    end
end

put("/api/internal/watchlist/{id}") do req, id
    handle(req) do req
        repo, user_id = watchlist_context(req)
        asset_id = watchlist_asset_id(id)
        follow_asset(repo, user_id, asset_id) || throw(not_found("asset not found"))
        json(Dict("asset_id" => asset_id))
    end
end

delete("/api/internal/watchlist/{id}") do req, id
    handle(req) do req
        repo, user_id = watchlist_context(req)
        asset_id = watchlist_asset_id(id)
        unfollow_asset(repo, user_id, asset_id) || throw(not_found("followed asset not found"))
        json(Dict("asset_id" => asset_id))
    end
end

get("/api/internal/watchlist/{id}/history") do req, id
    handle(req) do req
        repo, user_id = watchlist_context(req)
        asset_id = watchlist_asset_id(id)
        is_followed(repo, user_id, asset_id) || throw(not_found("followed asset not found"))
        points = price_history(configured_prices(), asset_id)
        json(Dict("points" => [[string(date), price] for (date, price) in points]))
    end
end

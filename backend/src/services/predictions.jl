const PREDICTION_LIMITATIONS = (
    "Historical distributions can change. The forecast is not a guarantee.",
    "The band describes individual sessions, not cumulative performance.",
    "Future dates without a close are estimated weekdays and may include holidays.",
)

function prediction_payload(fit, asset)
    return Dict{String,Any}(
        "model" => fit.model, "metric" => fit.metric, "horizon_days" => fit.horizon_days,
        "symbol" => asset.symbol, "market" => asset.market, "as_of" => string(fit.cutoff),
        "training_window" => (; from=string(fit.training_window.from), to=string(fit.training_window.to),
                             fit.training_window.observations),
        "parameters" => fit.parameters, "point" => fit.point, "lower_bound" => fit.lower_bound,
        "upper_bound" => fit.upper_bound, "anchor_closes" => fit.anchor_closes,
        "history" => [(date=string(date), value=value) for (date,value) in fit.history],
    )
end

function prediction_view(row, prices)
    p = row.payload
    forecast = (cutoff=Date(p["as_of"]), metric=p["metric"], horizon_days=Int(p["horizon_days"]),
                point=p["point"], lower_bound=p["lower_bound"], upper_bound=p["upper_bound"],
                anchor_closes=Float64.(p["anchor_closes"]))
    p["model"] == PREDICTION_MODEL || error("unsupported saved prediction model")
    evaluated = evaluate_prediction(forecast, prices)
    series = NamedTuple[]
    for x in p["history"]
        date, value = x isa NamedTuple ? (x.date, x.value) : (x["date"], x["value"])
        push!(series, (; date, phase="historical", date_estimated=false, historical_value=value,
                       forecast_point=nothing, lower_bound=nothing, upper_bound=nothing, observed_after_value=nothing))
    end
    date = forecast.cutoff
    for i in 1:forecast.horizon_days
        observed = i <= length(evaluated.observations) ? evaluated.observations[i] : nothing
        if observed === nothing
            date += Day(1)
            while dayofweek(date) > 5
                date += Day(1)
            end
        else
            date = observed.date
        end
        push!(series, (; date=string(date), phase="forecast", date_estimated=observed === nothing,
                      historical_value=nothing, forecast_point=forecast.point,
                      forecast.lower_bound, forecast.upper_bound,
                      observed_after_value=observed === nothing ? nothing : observed.value))
    end
    result = Dict(k => v for (k,v) in p if k ∉ ("anchor_closes", "history"))
    merge!(result, Dict("id"=>row.id, "asset_id"=>row.asset_id, "calculated_at"=>row.calculated_at,
                        "series"=>series, "evaluation"=>evaluated.summary, "limitations"=>PREDICTION_LIMITATIONS))
    return result
end

function generate_asset_prediction(predictions, prices, actor, asset_id; metric, horizon_days, as_of)
    asset = prediction_asset(prices, asset_id)
    asset === nothing && return nothing
    closes = price_history(prices, asset_id)
    require_observations(closes, PREDICTION_MIN_CLOSES, "prediction training")
    latest = maximum(first, closes)
    cutoff = something(as_of, latest)
    cutoff <= latest || throw(ArgumentError("as_of cannot be later than the latest stored close"))
    fit = fit_prediction(closes; cutoff, metric, horizon_days)
    payload = prediction_payload(fit, asset)
    # Evaluate before inserting so a response-calculation failure cannot leave a run behind.
    response = prediction_view((id="", asset_id, calculated_at="", payload), closes)
    row = save_prediction(predictions, actor, asset_id, payload)
    return merge!(response, Dict("id"=>row.id, "calculated_at"=>row.calculated_at))
end

function load_asset_prediction(predictions, prices, actor, id)
    row = read_prediction(predictions, actor, id)
    row === nothing && return nothing
    return prediction_view(row, price_history(prices, row.asset_id))
end

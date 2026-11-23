const PREDICTION_MODEL = "empirical_stationary_v1"
const PREDICTION_HORIZONS = (21, 63, 126)
const PREDICTION_MIN_CLOSES = 60
const PREDICTION_LOOKBACK_CLOSES = 252
const PREDICTION_VOLATILITY_SESSIONS = 21
const PREDICTION_SESSIONS_PER_YEAR = 252
const PREDICTION_CONFIDENCE = 0.90

function prediction_metric_series(closes, metric)
    returns = simple_returns(closes)
    validate_finite(returns, "return")
    metric == "return" && return returns
    window = PREDICTION_VOLATILITY_SESSIONS
    values = [volatility(view(returns, i-window+1:i); periods_per_year=PREDICTION_SESSIONS_PER_YEAR)
              for i in window:length(returns)]
    validate_finite(values, "volatility")
    return values
end

function prediction_slice(prices, eligible)
    selected = sort!([p for p in prices if eligible(first(p))]; by=first)
    allunique(first.(selected)) || throw(ArgumentError("prediction prices must have unique session dates"))
    return selected
end

"""
Fit a stationary reference model using only closes on or before the requested cutoff.
The point is the sample median; the band describes marginal session values, not an
interval for the cumulative return or a guarantee of future coverage.
"""
function fit_prediction(prices; cutoff::Date, metric, horizon_days)
    metric in ("return", "volatility") || throw(ArgumentError("unknown prediction metric"))
    horizon_days in PREDICTION_HORIZONS ||
        throw(ArgumentError("horizon_days must be 21, 63, or 126 sessions"))
    eligible = prediction_slice(prices, x -> x <= cutoff)
    require_observations(eligible, PREDICTION_MIN_CLOSES, "prediction training")
    training = last(eligible, min(length(eligible), PREDICTION_LOOKBACK_CLOSES))
    closes = last.(training)
    values = prediction_metric_series(closes, metric)
    dates = last(first.(training), length(values))
    tails = (1 - PREDICTION_CONFIDENCE) / 2
    anchor_size = metric == "return" ? 1 : PREDICTION_VOLATILITY_SESSIONS
    return (;
        model=PREDICTION_MODEL, metric, horizon_days, cutoff,
        parameters=(confidence=PREDICTION_CONFIDENCE, max_training_closes=PREDICTION_LOOKBACK_CLOSES,
                    volatility_sessions=PREDICTION_VOLATILITY_SESSIONS, sessions_per_year=PREDICTION_SESSIONS_PER_YEAR),
        training_window=(from=first(first(training)), to=first(last(training)), observations=length(values)),
        point=empirical_quantile(values, 0.5), lower_bound=empirical_quantile(values, tails),
        upper_bound=empirical_quantile(values, 1 - tails),
        history=[(date, value) for (date, value) in zip(dates, values)],
        anchor_closes=last(closes, anchor_size),
    )
end

"""
Compare only new closes, in actual session order, against the frozen training forecast.
Training-period revisions do not change the saved anchoring closes.
"""
function evaluate_prediction(forecast, prices)
    eligible = prediction_slice(prices, x -> x > forecast.cutoff)
    future = first(eligible, min(length(eligible), forecast.horizon_days))
    isempty(future) && return (observations=NamedTuple[], summary=nothing)
    values = prediction_metric_series([forecast.anchor_closes; last.(future)], forecast.metric)
    observations = [(session=i, date=first(future[i]), value=values[i]) for i in eachindex(future)]
    errors = values .- forecast.point
    return (; observations, summary=(
        observed_points=length(values), mae=sample_mean(abs.(errors)), rmse=sqrt(sample_mean(abs2.(errors))),
        interval_coverage=count(x -> forecast.lower_bound <= x <= forecast.upper_bound, values) / length(values),
    ))
end

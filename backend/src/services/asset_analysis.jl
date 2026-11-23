# Análisis de cierres en su moneda de cotización, sin datos interpolados.
const ASSET_ANALYSIS_ANNUALIZATION = 252
const MAX_ASSET_ANALYSIS_SYMBOLS = 12
const ASSET_ANALYSIS_PERIODS = Dict("3M" => Month(3), "6M" => Month(6), "1A" => Year(1), "3A" => Year(3))

function asset_analysis_window(period, from, to)
    if period == "custom"
        from !== nothing && to !== nothing || throw(ArgumentError("custom period requires from and to"))
        from < to <= from + Year(20) || throw(ArgumentError("custom period must be increasing and at most 20 years"))
        return from, to
    end
    haskey(ASSET_ANALYSIS_PERIODS, period) || throw(ArgumentError("unknown analysis period"))
    from === nothing && to === nothing || throw(ArgumentError("from and to require a custom period"))
    anchor = Date(now(Dates.UTC)) - Day(1)
    return anchor - ASSET_ANALYSIS_PERIODS[period], anchor
end

function asset_analysis_metrics(asset, dates, closes, simple, logs, selected)
    dd = drawdowns(closes)
    trough = argmin(dd)
    peak = argmax(view(closes, 1:trough))
    sigma = length(selected) < 2 ? nothing : volatility(selected)
    return (; asset_id=asset.id, asset.symbol, asset.name, asset.currency, observations=length(dates),
             effective_from=string(first(dates)), effective_to=string(last(dates)),
             simple_return=(last(closes) / first(closes)) - 1, log_return=sum(logs),
             cumulative_return=cumulative_return(simple), mean_return_daily=mean_return(selected),
             volatility_daily=sigma,
             volatility_annualized=sigma === nothing ? nothing : sigma * sqrt(ASSET_ANALYSIS_ANNUALIZATION),
             max_drawdown=dd[trough], peak_date=string(dates[peak]), trough_date=string(dates[trough]))
end

function asset_analysis_correlations(returns)
    defined = [length(values) >= 2 && any(!=(first(values)), values) for values in returns]
    return [[defined[i] && defined[j] ?
              (i == j ? 1.0 : correlation(returns[i], returns[j])) : nothing for j in eachindex(returns)]
            for i in eachindex(returns)]
end

function analyze_assets(prices::PriceRepository, symbols; period="1A", from=nothing, to=nothing, return_kind="simple")
    requested_from, requested_to = asset_analysis_window(period, from, to)
    return_kind in ("simple", "log") || throw(ArgumentError("return_kind must be simple or log"))
    length(symbols) in 1:MAX_ASSET_ANALYSIS_SYMBOLS ||
        throw(ArgumentError("symbols must contain between 1 and $MAX_ASSET_ANALYSIS_SYMBOLS entries"))
    normalized = [uppercase(strip(symbol)) for symbol in symbols]
    all(symbol -> !isempty(symbol) && length(symbol) <= 64, normalized) ||
        throw(ArgumentError("each symbol must have between 1 and 64 characters"))
    allunique(normalized) || throw(ArgumentError("symbols must be unique"))

    catalog = list_assets(prices)
    assets = map(normalized) do symbol
        matches = filter(a -> a.symbol == symbol, catalog)
        isempty(matches) && throw(ArgumentError("unknown asset symbol $symbol"))
        length(matches) == 1 || throw(ArgumentError("ambiguous asset symbol $symbol"))
        return only(matches)
    end
    history = [filter(point -> requested_from <= point[1] <= requested_to, price_history(prices, asset.id)) for asset in assets]
    aligned = aligned_prices(history; from=requested_from, min_days=2)
    simple, logs = map(simple_returns, aligned.prices), map(log_returns, aligned.prices)
    selected = return_kind == "log" ? logs : simple
    metrics = [asset_analysis_metrics(assets[i], aligned.dates, aligned.prices[i], simple[i], logs[i], selected[i])
               for i in eachindex(assets)]
    series = map(eachindex(assets)) do i
        closes = aligned.prices[i]
        (; symbol=assets[i].symbol, points=[[string(date), 100 * (close / first(closes))]
                                          for (date, close) in zip(aligned.dates, closes)])
    end
    return (; selected_symbols=normalized, period_preset=period, return_kind,
             requested_from=string(requested_from), requested_to=string(requested_to),
             effective_from=string(first(aligned.dates)), effective_to=string(last(aligned.dates)),
             aligned_observations=length(aligned.dates), annualization_factor=ASSET_ANALYSIS_ANNUALIZATION,
             per_asset_metrics=metrics, series_aligned=series, correlation_symbols=normalized,
             correlation_matrix=asset_analysis_correlations(selected))
end

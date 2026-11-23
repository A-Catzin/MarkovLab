# Valida que la fuente no cambie la identidad de un activo del catálogo.
struct WatchlistMarketSource <: MarketDataSource
    source::MarketDataSource
    markets::Dict{String,String}
end

function fetch_daily_prices(source::WatchlistMarketSource, symbols, from::Date, to::Date)
    return filter(fetch_daily_prices(source.source, symbols, from, to)) do series
        series.details === nothing ||
            get(source.markets, series.symbol, nothing) == series.details.market
    end
end

"""
Procesa una tanda de solicitudes guardadas. La reclamación se confirma antes de
llamar a la fuente; no se mantiene una transacción abierta durante la consulta.
Los trabajos en curso no se reintentan automáticamente si el proceso se interrumpe.
"""
function process_market_refresh!(queue::PostgresWatchlist, prices::PriceRepository,
                                 source::MarketDataSource; to::Date=Dates.today() - Day(1))
    jobs = claim_market_refresh!(queue, APIFY_BATCH_SIZE)
    isempty(jobs) && return (; completed=0, failed=0)
    symbols = [job.symbol for job in jobs]
    markets = Dict(job.symbol => job.market for job in jobs)
    result = sync_market_prices(prices, WatchlistMarketSource(source, markets), symbols; to)
    successes = Set(result.up_to_date)
    for item in result.fetched
        item.status in (:success, :partial) && push!(successes, item.symbol)
    end
    first_failure = nothing
    for symbol in symbols
        try
            finish_market_refresh!(queue, symbol, symbol in successes)
        catch err
            err isa InterruptException && rethrow()
            @error "Could not persist market refresh outcome" symbol error_type = nameof(typeof(err))
            first_failure = something(first_failure, err)
        end
    end
    # Los demás resultados ya se intentaron guardar. El proceso conserva el
    # fallo de salida original y nunca vuelve a consultar por este lote.
    first_failure === nothing || throw(first_failure)
    return (; completed=length(successes), failed=length(jobs) - length(successes))
end

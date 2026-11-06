# Carga de precios desde una fuente de mercado (API), sin CSV.

"""Fecha desde la que se pide el historial de un símbolo que todavía no tiene precios."""
const MARKET_HISTORY_START = Date(2000, 1, 1)
"""Símbolos por corrida: Apify cobra por activo, y un tope evita una corrida enorme por error."""
const MAX_SYNC_SYMBOLS = 50

"""
    sync_market_prices(prices, source, symbols; from=nothing, to=today() - Day(1))
        -> (; fetched::Vector{PriceImportSummary}, up_to_date::Vector{String}, corrected::Dict{String,Int})

Trae de `source` los precios diarios de `symbols` y los guarda con origen `api`, cada
símbolo en su propia importación (activo, precios y registro en `sincronizaciones`).

- **Carga histórica:** con `from`, pide desde esa fecha.
- **Actualización:** sin `from`, cada símbolo sigue desde el día después de su último
  precio de origen `api` ([`latest_price_date`](@ref)), o desde
  [`MARKET_HISTORY_START`](@ref) si no tiene ninguno. Se hace una sola consulta, desde el
  inicio más antiguo; los precios que ya estaban guardados no se duplican.
- `to` es ayer por defecto: el precio del día en curso nunca se guarda (ver
  [`fetch_daily_prices`](@ref)), así que pedir hasta hoy solo gastaría cuota.
- Un símbolo sin nada nuevo que pedir no se consulta (no gasta cuota), y una respuesta sin
  precios nuevos no registra una importación vacía: los dos quedan en `up_to_date`.
- Cada símbolo guarda solo desde su propio inicio: una actualización no rellena hacia
  atrás el historial de otro.
- Un símbolo que la fuente no pudo leer, que no vino en la respuesta o que es nuevo y no
  trajo ningún precio queda como importación `:failed` sin activo. Si la fuente no responde
  ([`MarketDataError`](@ref)), todos los símbolos pendientes quedan así, con el motivo.

Lanza `ArgumentError` si no hay símbolos, si son más de [`MAX_SYNC_SYMBOLS`](@ref) o si
`from` es posterior a `to`.
"""
function sync_market_prices(prices::PriceRepository, source::MarketDataSource,
                            symbols::AbstractVector{<:AbstractString};
                            from::Union{Nothing,Date}=nothing, to::Date=Dates.today() - Day(1))
    requested = unique!([uppercase(strip(s)) for s in symbols])
    filter!(!isempty, requested)
    isempty(requested) && throw(ArgumentError("indicate at least one symbol"))
    length(requested) > MAX_SYNC_SYMBOLS &&
        throw(ArgumentError("sync at most $MAX_SYNC_SYMBOLS symbols per run, got $(length(requested))"))
    from !== nothing && from > to && throw(ArgumentError("the start date $from is after the end date $to"))

    latest = Dict(symbol => latest_price_date(prices, symbol) for symbol in requested)
    has_history = Dict(symbol => latest[symbol] !== nothing for symbol in requested)
    starts = Dict(symbol => something(from, next_day(latest[symbol]), MARKET_HISTORY_START) for symbol in requested)
    pending = [symbol for symbol in requested if starts[symbol] <= to]
    up_to_date = [symbol for symbol in requested if starts[symbol] > to]
    fetched = PriceImportSummary[]
    # Filas guardadas como día plano al cierre, por símbolo (ver `MarketSeries.corrected`).
    corrected = Dict{String,Int}()
    isempty(pending) && return (; fetched, up_to_date, corrected)

    response = try
        fetch_daily_prices(source, pending, minimum(starts[s] for s in pending), to)
    catch err
        err isa MarketDataError || rethrow()
        # Sin respuesta, cada símbolo queda registrado como fallido con el motivo.
        for symbol in pending
            save_price_import(prices, symbol, nothing, PriceBar[], :failed, 0, err.message; source=:api)
            push!(fetched, PriceImportSummary(symbol, nothing, 0, 0, 0, ImportIssue[], ImportIssue[], :failed))
        end
        return (; fetched, up_to_date, corrected)
    end
    received = Dict(series.symbol => series for series in response)
    for symbol in pending
        series = get(received, symbol, nothing)
        if series === nothing || series.error !== nothing || series.details === nothing
            message = series === nothing ? "the source returned nothing for $symbol" :
                      something(series.error, "the source returned no asset data for $symbol")
            save_price_import(prices, symbol, nothing, PriceBar[], :failed, 0, message; source=:api)
            push!(fetched, PriceImportSummary(symbol, nothing, 0, 0, 0, ImportIssue[], ImportIssue[], :failed))
            continue
        end
        # La consulta empieza en el inicio más antiguo: cada símbolo guarda solo desde el suyo.
        bars = filter(bar -> starts[symbol] <= bar.date <= to, series.bars)
        if isempty(bars) && isempty(series.invalid) && has_history[symbol]
            push!(up_to_date, symbol)
            continue
        end
        status = isempty(bars) ? :failed : isempty(series.invalid) ? :success : :partial
        notes = String[]
        isempty(series.invalid) ||
            push!(notes, "$(length(series.invalid)) invalid rows; first at row $(first(series.invalid).line): $(first(series.invalid).message)")
        isempty(series.corrected) ||
            push!(notes, "$(length(series.corrected)) rows kept with the close only (inconsistent open, high or low)")
        message = isempty(notes) ? nothing : join(notes, ". ")
        isempty(series.corrected) || (corrected[symbol] = length(series.corrected))
        asset_id, inserted = save_price_import(prices, symbol, series.details, bars, status,
                                               length(series.invalid), message; source=:api)
        push!(fetched, PriceImportSummary(symbol, asset_id, length(bars), inserted, length(bars) - inserted,
                                          series.invalid, ImportIssue[], status))
    end
    return (; fetched, up_to_date, corrected)
end

next_day(date::Date) = date + Day(1)
next_day(::Nothing) = nothing

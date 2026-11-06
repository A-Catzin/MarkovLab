# Adaptador de precios de mercado sobre Apify: corre el Actor kaix/yahoo-finance-scraper,
# que lee Yahoo Finance, y traduce su respuesta a `MarketSeries`. Detalles y costos en
# documentacion/tecnica/PRECIOS_API.md.

const APIFY_ACTOR = "kaix~yahoo-finance-scraper"
const APIFY_RUN_URL = "https://api.apify.com/v2/acts/%s/run-sync-get-dataset-items"
# La corrida síncrona de Apify espera hasta 300 s. Con el historial completo, el Actor tarda
# unos 11 s por símbolo y acumula los datos en memoria (con los 128 MB por defecto se cayó al
# símbolo 17, el 2026-11-06): por eso se corre en tandas y con 1 GB. Apify cobra el inicio de
# la corrida por GB ($0.00005), no por tiempo.
const APIFY_TIMEOUT_SECONDS = 300
const APIFY_BATCH_SIZE = 5
const APIFY_MEMORY_MB = 1024

# Códigos de bolsa de Yahoo → nombre del mercado en el catálogo (siempre en mayúsculas).
const YAHOO_MARKETS = Dict("NMS" => "NASDAQ", "NGM" => "NASDAQ", "NCM" => "NASDAQ", "NAS" => "NASDAQ",
                           "NYQ" => "NYSE", "PCX" => "NYSEARCA", "ASE" => "NYSEAMERICAN", "BTS" => "CBOE",
                           "MEX" => "BMV")

# Tipos de instrumento de Yahoo → categoría del catálogo.
const YAHOO_CATEGORIES = Dict("EQUITY" => "Acción", "ETF" => "ETF", "MUTUALFUND" => "Fondo", "INDEX" => "Índice",
                              "CRYPTOCURRENCY" => "Cripto", "CURRENCY" => "Divisa", "FUTURE" => "Futuro")

"""
    ApifyMarketData(token; actor=APIFY_ACTOR, timeout=APIFY_TIMEOUT_SECONDS)

Fuente de precios que corre un Actor de Apify con el token de la cuenta (`APIFY_TOKEN`).
El token viaja solo en el encabezado `Authorization` y nunca se muestra al imprimir el valor.
"""
struct ApifyMarketData <: MarketDataSource
    token::String
    actor::String
    timeout::Int

    function ApifyMarketData(token::AbstractString; actor::AbstractString=APIFY_ACTOR,
                             timeout::Integer=APIFY_TIMEOUT_SECONDS)
        cleaned = strip(token)
        isempty(cleaned) && throw(ArgumentError("the Apify token must not be empty"))
        return new(String(cleaned), String(actor), Int(timeout))
    end
end

Base.show(io::IO, source::ApifyMarketData) = print(io, "ApifyMarketData(actor=", source.actor, ", token=<oculto>)")
Base.show(io::IO, ::MIME"text/plain", source::ApifyMarketData) = show(io, source)

"""
    actor_input(symbols, from, to) -> Dict

Entrada del Actor: solo el gráfico de precios diarios, con fechas explícitas. Con
`chartRange: "max"` Yahoo resume el historial en barras mensuales o trimestrales, por eso
no se usa. El fin se pide un día después para que `to` quede incluido.
"""
function actor_input(symbols::AbstractVector{<:AbstractString}, from::Date, to::Date)
    off = ("includeQuote", "includeProfile", "includeFinancials", "includeNews", "includeRecommendations",
           "includeInsights", "includeAnalyst", "includeOwnership", "includeOptions")
    input = Dict{String,Any}(key => false for key in off)
    input["symbols"] = collect(String, symbols)
    input["includeChart"] = true
    input["chartInterval"] = "1d"
    input["chartStartDate"] = string(from)
    input["chartEndDate"] = string(to + Day(1))
    return input
end

function fetch_daily_prices(source::ApifyMarketData, symbols::AbstractVector{<:AbstractString}, from::Date, to::Date)
    return fetch_in_batches(batch -> run_actor(source, batch, from, to), symbols)
end

"""
    fetch_in_batches(run, symbols; size=APIFY_BATCH_SIZE) -> Vector{MarketSeries}

Llama a `run` con tandas de hasta `size` símbolos y junta las series. Si una tanda falla
([`MarketDataError`](@ref)), sus símbolos vuelven como series con ese error y las demás
tandas siguen.
"""
function fetch_in_batches(run, symbols::AbstractVector{<:AbstractString}; size::Integer=APIFY_BATCH_SIZE)
    series = MarketSeries[]
    for batch in Iterators.partition(collect(String, symbols), size)
        try
            append!(series, run(batch))
        catch err
            err isa MarketDataError || rethrow()
            append!(series, [MarketSeries(s, nothing, PriceBar[], ImportIssue[], err.message) for s in batch])
        end
    end
    return series
end

function run_actor(source::ApifyMarketData, symbols::AbstractVector{<:AbstractString}, from::Date, to::Date)
    url = replace(APIFY_RUN_URL, "%s" => source.actor) * "?format=json&clean=true&memory=$(APIFY_MEMORY_MB)"
    headers = ["Authorization" => "Bearer $(source.token)", "Content-Type" => "application/json"]
    # Los mensajes de error nunca incluyen la solicitud ni sus encabezados: llevan el token.
    response = try
        HTTP.post(url, headers, JSON.json(actor_input(symbols, from, to));
                  request_timeout=source.timeout, retry=false, status_exception=false)
    catch err
        err isa InterruptException && rethrow()
        throw(MarketDataError("could not reach Apify ($(nameof(typeof(err))))"))
    end
    200 <= response.status < 300 ||
        throw(MarketDataError("Apify answered HTTP $(response.status)$(apify_error_type(response.body)) for actor $(source.actor)"))
    items = try
        JSON.parse(String(response.body))
    catch
        nothing
    end
    items isa AbstractVector ||
        throw(MarketDataError("Apify returned an unexpected response for actor $(source.actor)"))
    return parse_actor_items(items)
end

# Tipo de error que Apify manda en el cuerpo (por ejemplo `run-failed`), sin el resto del
# texto. El cuerpo de una respuesta de Apify no incluye el token.
function apify_error_type(body)
    parsed = try
        JSON.parse(String(copy(body)))
    catch
        nothing
    end
    error_info = parsed isa AbstractDict ? get(parsed, "error", nothing) : nothing
    kind = error_info isa AbstractDict ? get(error_info, "type", nothing) : nothing
    return kind isa AbstractString && occursin(r"^[a-z0-9-]{1,60}$", kind) ? " ($kind)" : ""
end

"""
    parse_actor_items(items; now=Dates.now(UTC)) -> Vector{MarketSeries}

Traduce los elementos del dataset del Actor (uno por símbolo) a `MarketSeries`:

- La fecha de cada precio es la fecha local del mercado (`timestamp + gmtoffset`),
  redondeada al día más cercano: `gmtoffset` es el de hoy, y en una fecha con otro horario
  (verano) una marca a medianoche quedaría una hora antes, en el día anterior.
- Se descartan los precios del día en curso del mercado según `now`: todavía cambian, y
  como un precio guardado no se vuelve a escribir, quedarían congelados a media sesión.
- Una fila con cierre válido pero apertura, máximo o mínimo faltantes o incoherentes (en
  la BMV, Yahoo trae días como apertura = máximo = mínimo = 32 con cierre de 36.31, que
  coincide con los días vecinos) se guarda como un día plano al cierre y se reporta en
  `corrected`: el análisis usa el cierre ajustado, y así no se pierde el día. Sin volumen,
  queda en 0.
- Las filas sin ningún precio (días sin operaciones) se ignoran.
- Las filas que ni así pasan las reglas de `PriceBar` (por ejemplo, un cierre nulo) se
  reportan en `invalid` y no detienen las demás.
- Un elemento sin gráfico, con error o con barras que no son diarias se vuelve un
  `MarketSeries` con `error` y sin precios.
"""
function parse_actor_items(items::AbstractVector; now::DateTime=Dates.now(UTC))
    return [parse_actor_item(item, now) for item in items if item isa AbstractDict]
end

function parse_actor_item(item::AbstractDict, now::DateTime)
    symbol = uppercase(strip(string(something(get(item, "symbol", nothing), "?"))))
    failure(message) = MarketSeries(symbol, nothing, PriceBar[], ImportIssue[], message)
    status = get(item, "status", nothing)
    status == "complete" || return failure("the source could not read $symbol (status $(something(status, "unknown")))")
    chart = get(item, "chart", nothing)
    chart isa AbstractDict || return failure("the source returned no prices for $symbol")
    meta = get(chart, "meta", nothing)
    rows = get(chart, "series", nothing)
    (meta isa AbstractDict && rows isa AbstractVector) || return failure("the source returned no prices for $symbol")
    granularity = get(meta, "dataGranularity", nothing)
    granularity == "1d" || return failure("expected daily prices for $symbol, got $(something(granularity, "unknown"))")

    details = try
        asset_details(meta, symbol)
    catch err
        err isa ArgumentError || rethrow()
        return failure("invalid asset data for $symbol: $(err.msg)")
    end
    offset = Int(something(get(meta, "gmtoffset", nothing), 0))
    today_local = Date(now + Second(offset))
    bars = PriceBar[]
    invalid = ImportIssue[]
    corrected = ImportIssue[]
    for (index, row) in enumerate(rows)
        # Yahoo manda filas sin ningún precio en días sin operaciones: no son errores.
        row isa AbstractDict && all(get(row, key, nothing) === nothing for key in ("open", "high", "low", "close")) &&
            continue
        try
            bar, problem = row_bar(symbol, row, offset)
            bar.date < today_local || continue
            push!(bars, bar)
            problem === nothing || push!(corrected, ImportIssue(index, problem))
        catch err
            err isa ArgumentError || err isa MethodError || err isa InexactError || rethrow()
            push!(invalid, ImportIssue(index, err isa ArgumentError ? err.msg : "missing or invalid values"))
        end
    end
    sort!(bars; by=bar -> bar.date)
    return MarketSeries(symbol, details, unique(bar -> bar.date, bars), invalid, nothing, corrected)
end

function asset_details(meta::AbstractDict, symbol::AbstractString)
    text(key) = (value = get(meta, key, nothing); value isa AbstractString && !isempty(strip(value)) ? value : nothing)
    name = something(text("longName"), text("shortName"), symbol)
    code = something(text("exchangeName"), "")
    market = get(YAHOO_MARKETS, code, something(text("fullExchangeName"), code, "?"))
    kind = something(text("instrumentType"), "")
    category = get(YAHOO_CATEGORIES, kind, isempty(kind) ? "Otro" : titlecase(kind))
    return AssetDetails(name, market, category, something(text("currency"), ""))
end

function row_bar(symbol::AbstractString, row::AbstractDict, offset::Integer)
    number(key) = (value = get(row, key, nothing); value isa Real ? Float64(value) :
                   throw(ArgumentError("$key is missing")))
    timestamp = get(row, "timestamp", nothing)
    timestamp isa Real || throw(ArgumentError("timestamp is missing"))
    date = Date(round(unix2datetime(timestamp + offset), Day))
    adj = get(row, "adjclose", nothing)
    adj = adj isa Real ? adj : nothing
    try
        return PriceBar(symbol, date, number("open"), number("high"), number("low"), number("close"),
                        number("volume"), adj), nothing
    catch err
        err isa ArgumentError || rethrow()
        # Sin un cierre válido no hay nada que rescatar: la fila es inválida.
        close = number("close")
        volume = get(row, "volume", nothing)
        flat = PriceBar(symbol, date, close, close, close, close, volume isa Real ? volume : 0.0, adj)
        return flat, "open, high or low were inconsistent ($(err.msg)); kept with the close only"
    end
end

"""
    InMemoryPriceRepository()

Adaptador de precios en memoria con las mismas reglas que las tablas `activos`,
`precios_historicos` y `sincronizaciones`: un activo por mercado y símbolo, un precio
por activo, fecha y origen, y un registro por importación. Sirve para las pruebas.
"""
struct InMemoryPriceRepository <: PriceRepository
    assets::Dict{Tuple{String,String},@NamedTuple{id::Int, details::AssetDetails}}
    bars::Dict{Tuple{Int,Date,Symbol},PriceBar}
    syncs::Vector{@NamedTuple{asset_id::Union{Nothing,Int}, source::Symbol, status::Symbol, saved::Int, failed::Int,
                              message::Union{Nothing,String}}}
    # Tipos de cambio por moneda, fecha y origen, como la tabla `tipos_cambio`.
    rates::Dict{Tuple{String,Date,Symbol},Float64}
    lock::ReentrantLock
end

InMemoryPriceRepository() = InMemoryPriceRepository(Dict(), Dict(), [], Dict(), ReentrantLock())

function save_price_import(prices::InMemoryPriceRepository, symbol, details::Union{Nothing,AssetDetails},
                           bars::AbstractVector{PriceBar}, status::Symbol, failed_rows::Integer,
                           message; source::Symbol=:csv)
    check_import(details, bars, status, source)
    lock(prices.lock) do
        asset_id = nothing
        inserted = 0
        if !isempty(bars)
            key = (details.market, symbol)
            current = Base.get(prices.assets, key, nothing)
            asset_id = current === nothing ? length(prices.assets) + 1 : current.id
            prices.assets[key] = (id=asset_id, details=details)
            for bar in bars
                bar_key = (asset_id, bar.date, source)
                haskey(prices.bars, bar_key) && continue
                prices.bars[bar_key] = bar
                inserted += 1
            end
        end
        push!(prices.syncs, (asset_id=asset_id, source=source, status=status, saved=inserted, failed=Int(failed_rows),
                             message=message))
        return (asset_id, inserted)
    end
end

function list_assets(prices::InMemoryPriceRepository)
    lock(prices.lock) do
        rows = map(collect(prices.assets)) do ((market, symbol), asset)
            dates = sort!([key[2] for key in keys(prices.bars) if key[1] == asset.id])
            (id=asset.id, symbol=symbol, name=asset.details.name, market=market,
             category=asset.details.category, currency=asset.details.currency, last_synced_at=nothing,
             price_rows=length(dates), first_date=isempty(dates) ? nothing : first(dates),
             last_date=isempty(dates) ? nothing : last(dates))
        end
        return sort!(rows; by=row -> (row.market, row.symbol))
    end
end

function list_imports(prices::InMemoryPriceRepository; limit::Integer=50)
    lock(prices.lock) do
        symbols = Dict(asset.id => (symbol, market) for ((market, symbol), asset) in prices.assets)
        rows = map(enumerate(prices.syncs)) do (index, sync)
            symbol, market = sync.asset_id === nothing ? (nothing, nothing) : symbols[sync.asset_id]
            (id=index, source=sync.source, status=sync.status, asset_symbol=symbol, asset_market=market,
             saved=sync.saved, failed=sync.failed, message=sync.message, started_at=nothing, finished_at=nothing)
        end
        return first(reverse!(rows), limit)
    end
end

function latest_price_date(prices::InMemoryPriceRepository, symbol::AbstractString; source::Symbol=:api)
    wanted = uppercase(strip(symbol))
    lock(prices.lock) do
        ids = Set(asset.id for ((_, s), asset) in prices.assets if s == wanted)
        dates = [date for (id, date, origin) in keys(prices.bars) if id in ids && origin == source]
        return isempty(dates) ? nothing : maximum(dates)
    end
end

function save_exchange_rates(prices::InMemoryPriceRepository, currency::AbstractString, rates::AbstractVector;
                             source::Symbol=:api)
    code = check_exchange_rates(currency, rates, source)
    lock(prices.lock) do
        inserted = 0
        for (date, value) in rates
            key = (code, Date(date), source)
            haskey(prices.rates, key) && continue
            prices.rates[key] = Float64(value)
            inserted += 1
        end
        return inserted
    end
end

function exchange_rates(prices::InMemoryPriceRepository, currency::AbstractString)
    code = uppercase(strip(currency))
    lock(prices.lock) do
        by_date = Dict{Date,Tuple{Bool,Float64}}()
        for ((c, date, source), value) in prices.rates
            c == code || continue
            from_api = source == :api
            current = get(by_date, date, nothing)
            current !== nothing && current[1] && !from_api && continue
            by_date[date] = (from_api, value)
        end
        return sort!([(date, value) for (date, (_, value)) in by_date])
    end
end

function latest_exchange_rate_date(prices::InMemoryPriceRepository, currency::AbstractString; source::Symbol=:api)
    code = uppercase(strip(currency))
    lock(prices.lock) do
        dates = [date for (c, date, s) in keys(prices.rates) if c == code && s == source]
        return isempty(dates) ? nothing : maximum(dates)
    end
end

function price_history(prices::InMemoryPriceRepository, asset_id::Integer)
    lock(prices.lock) do
        by_date = Dict{Date,Tuple{Bool,Float64}}()
        for ((id, date, source), bar) in prices.bars
            id == asset_id || continue
            from_api = source == :api
            current = get(by_date, date, nothing)
            current !== nothing && current[1] && !from_api && continue
            by_date[date] = (from_api, something(bar.adj_close, bar.close))
        end
        return sort!([(date, price) for (date, (_, price)) in by_date])
    end
end

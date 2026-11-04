"""
    InMemoryPriceRepository()

Adaptador de precios en memoria con las mismas reglas que las tablas `activos`,
`precios_historicos` y `sincronizaciones`: un activo por mercado y símbolo, un precio
por activo, fecha y origen, y un registro por importación. Sirve para las pruebas.
"""
struct InMemoryPriceRepository <: PriceRepository
    assets::Dict{Tuple{String,String},@NamedTuple{id::Int, details::AssetDetails}}
    bars::Dict{Tuple{Int,Date,Symbol},PriceBar}
    syncs::Vector{@NamedTuple{asset_id::Union{Nothing,Int}, status::Symbol, saved::Int, failed::Int,
                              message::Union{Nothing,String}}}
    lock::ReentrantLock
end

InMemoryPriceRepository() = InMemoryPriceRepository(Dict(), Dict(), [], ReentrantLock())

function save_price_import(prices::InMemoryPriceRepository, symbol, details::AssetDetails,
                           bars::AbstractVector{PriceBar}, status::Symbol, failed_rows::Integer,
                           message)
    status in IMPORT_STATUSES || throw(ArgumentError("unknown import status $status"))
    lock(prices.lock) do
        asset_id = nothing
        inserted = 0
        if !isempty(bars)
            key = (details.market, symbol)
            current = Base.get(prices.assets, key, nothing)
            asset_id = current === nothing ? length(prices.assets) + 1 : current.id
            prices.assets[key] = (id=asset_id, details=details)
            for bar in bars
                bar_key = (asset_id, bar.date, :csv)
                haskey(prices.bars, bar_key) && continue
                prices.bars[bar_key] = bar
                inserted += 1
            end
        end
        push!(prices.syncs, (asset_id=asset_id, status=status, saved=inserted, failed=Int(failed_rows),
                             message=message))
        return (asset_id, inserted)
    end
end

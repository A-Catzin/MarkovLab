"""
    InMemoryPortfolioRepository(prices::InMemoryPriceRepository)

Adaptador de carteras en memoria, para las pruebas. Toma los activos del repositorio de
precios en memoria, igual que en la base las posiciones apuntan a `activos`.
"""
struct InMemoryPortfolioRepository <: PortfolioRepository
    prices::InMemoryPriceRepository
    owners::Dict{String,String}
    saved::Vector{SavedPortfolio}
    lock::ReentrantLock
end

InMemoryPortfolioRepository(prices::InMemoryPriceRepository) =
    InMemoryPortfolioRepository(prices, Dict{String,String}(), SavedPortfolio[], ReentrantLock())

function create_portfolio(portfolios::InMemoryPortfolioRepository, user_id, draft::PortfolioDraft)
    lock(portfolios.lock) do
        catalog = Dict(asset.id => (symbol=symbol, market=market, name=asset.details.name)
                       for ((market, symbol), asset) in portfolios.prices.assets)
        unknown = [p.asset_id for p in draft.positions if !haskey(catalog, p.asset_id)]
        isempty(unknown) || throw(ArgumentError("unknown asset ids: $(join(unknown, ", "))"))
        positions = [SavedPosition(p.asset_id, catalog[p.asset_id].symbol, catalog[p.asset_id].market,
                                   catalog[p.asset_id].name, p.weight) for p in draft.positions]
        saved = SavedPortfolio(random_uuid(), draft.name, draft.capital, draft.currency, string(Dates.today()),
                               :draft, nothing, positions)
        push!(portfolios.saved, saved)
        portfolios.owners[saved.id] = user_id
        return saved
    end
end

list_portfolios(portfolios::InMemoryPortfolioRepository, user_id) =
    lock(() -> reverse([p for p in portfolios.saved if portfolios.owners[p.id] == user_id]), portfolios.lock)

function get_portfolio(portfolios::InMemoryPortfolioRepository, user_id, id)
    is_uuid(id) || return nothing
    lock(portfolios.lock) do
        index = findfirst(p -> p.id == lowercase(id) && portfolios.owners[p.id] == user_id, portfolios.saved)
        return index === nothing ? nothing : portfolios.saved[index]
    end
end

function delete_portfolio(portfolios::InMemoryPortfolioRepository, user_id, id)
    is_uuid(id) || return false
    lock(portfolios.lock) do
        index = findfirst(p -> p.id == lowercase(id) && portfolios.owners[p.id] == user_id, portfolios.saved)
        index === nothing && return false
        delete!(portfolios.owners, portfolios.saved[index].id)
        deleteat!(portfolios.saved, index)
        return true
    end
end

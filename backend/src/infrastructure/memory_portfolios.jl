"""
    InMemoryPortfolioRepository(prices::InMemoryPriceRepository)

Adaptador de carteras en memoria, para las pruebas. Toma los activos del repositorio de
precios en memoria, igual que en la base las posiciones apuntan a `activos`.
"""
struct InMemoryPortfolioRepository <: PortfolioRepository
    prices::InMemoryPriceRepository
    owners::Dict{String,String}
    saved::Vector{SavedPortfolio}
    versions::Dict{String,Vector{Dict{String,Any}}}
    parents::Dict{String,String}
    version_dates::Dict{String,String}
    lock::ReentrantLock
end

InMemoryPortfolioRepository(prices::InMemoryPriceRepository) =
    InMemoryPortfolioRepository(prices, Dict{String,String}(), SavedPortfolio[],
                                Dict{String,Vector{Dict{String,Any}}}(), Dict{String,String}(),
                                Dict{String,String}(), ReentrantLock())

function memory_portfolio_positions(portfolios, draft)
    catalog = Dict(asset.id => (symbol=symbol, market=market, name=asset.details.name,
                                    currency=asset.details.currency)
                       for ((market, symbol), asset) in portfolios.prices.assets)
    unknown = [p.asset_id for p in draft.positions if !haskey(catalog, p.asset_id)]
    isempty(unknown) || throw(ArgumentError("unknown asset ids: $(join(unknown, ", "))"))
    return [SavedPosition(p.asset_id, catalog[p.asset_id].symbol, catalog[p.asset_id].market,
                                   catalog[p.asset_id].name, p.weight, catalog[p.asset_id].currency)
                     for p in draft.positions]
end

function create_portfolio(portfolios::InMemoryPortfolioRepository, user_id, draft::PortfolioDraft)
    lock(portfolios.lock) do
        positions = memory_portfolio_positions(portfolios, draft)
        saved = SavedPortfolio(random_uuid(), draft.name, draft.capital, draft.currency, string(something(draft.start_date, Dates.today())),
                               :draft, nothing, positions)
        push!(portfolios.saved, saved)
        portfolios.owners[saved.id] = user_id
        portfolios.version_dates[saved.id] = portfolio_now()
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
        id = portfolios.saved[index].id
        delete!(portfolios.owners, id)
        delete!(portfolios.versions, id)
        delete!(portfolios.parents, id)
        delete!(portfolios.version_dates, id)
        deleteat!(portfolios.saved, index)
        return true
    end
end

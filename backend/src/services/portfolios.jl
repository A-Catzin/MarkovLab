# Casos de uso de "Mis carteras". El actor es el usuario que navega en Next.js
# (`X-Actor-Id`): debe existir en la base, y solo ve y modifica sus propias carteras.

"""
    require_user(users::UserRepository, actor_id) -> AppUser

Devuelve al usuario `actor_id` si existe; si no, lanza `ForbiddenError`.
"""
function require_user(users::UserRepository, actor_id)
    user = actor_id === nothing ? nothing : find_user(users, actor_id)
    user === nothing && throw(ForbiddenError("signed-in user required"))
    return user
end

"""
    create_user_portfolio(users, portfolios, actor_id, draft::PortfolioDraft) -> SavedPortfolio

Guarda la cartera a nombre del actor (RF-27, RF-28). Lanza `ForbiddenError` si el actor no
existe y `ArgumentError` si algún activo no está en el catálogo.
"""
create_user_portfolio(users::UserRepository, portfolios::PortfolioRepository, actor_id, draft::PortfolioDraft) =
    create_portfolio(portfolios, require_user(users, actor_id).id, draft)

"""
    list_user_portfolios(users, portfolios, actor_id) -> Vector{SavedPortfolio}

Carteras del actor, de la más nueva a la más vieja.
"""
list_user_portfolios(users::UserRepository, portfolios::PortfolioRepository, actor_id) =
    list_portfolios(portfolios, require_user(users, actor_id).id)

"""
    get_user_portfolio(users, portfolios, actor_id, id) -> Union{SavedPortfolio,Nothing}

Una cartera del actor; `nothing` si no existe o es de otro usuario (para él no existe).
"""
get_user_portfolio(users::UserRepository, portfolios::PortfolioRepository, actor_id, id) =
    get_portfolio(portfolios, require_user(users, actor_id).id, id)

"""
    delete_user_portfolio(users, portfolios, actor_id, id) -> Bool

Borra una cartera del actor; `false` si no existe o es de otro usuario.
"""
delete_user_portfolio(users::UserRepository, portfolios::PortfolioRepository, actor_id, id) =
    delete_portfolio(portfolios, require_user(users, actor_id).id, id)

"""
    user_portfolio_history(users, portfolios, prices, actor_id, id)
        -> Union{Nothing,NamedTuple}

Valor diario de una cartera del actor según [`portfolio_value_history`](@ref), anclado en el
día en que la creó (`start_date`): `(; portfolio, dates, values, anchor)`. `nothing` si la
cartera no existe o es de otro usuario. Lanza `InsufficientDataError` si sus activos no
tienen al menos dos días de precios en común.
"""
function user_portfolio_history(users::UserRepository, portfolios::PortfolioRepository, prices::PriceRepository,
                                actor_id, id)
    portfolio = get_user_portfolio(users, portfolios, actor_id, id)
    portfolio === nothing && return nothing
    series = [price_history(prices, position.asset_id) for position in portfolio.positions]
    history = portfolio_value_history(series, [position.weight for position in portfolio.positions],
                                      portfolio.capital, Date(portfolio.start_date))
    return (; portfolio, history.dates, history.values, history.anchor)
end

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

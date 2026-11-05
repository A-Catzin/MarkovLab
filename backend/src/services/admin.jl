"""
    require_admin(users::UserRepository, actor_id) -> AppUser

Devuelve al usuario `actor_id` si existe y es admin; si no, lanza `ForbiddenError`. Lo
llaman todas las operaciones de admin, aunque el frontend ya haya revisado el rol: el
permiso se decide con lo que dice la base en este momento, no con un token que puede ser
viejo.
"""
function require_admin(users::UserRepository, actor_id)
    actor = actor_id === nothing ? nothing : find_user(users, actor_id)
    (actor !== nothing && actor.role == :admin) || throw(ForbiddenError("admin role required"))
    return actor
end

"""
    change_user_role(users::UserRepository, actor_id, target_id, role) -> Union{AppUser,Nothing}

Cambia el rol de `target_id` (`:user` o `:admin`) si `actor_id` es admin. Lanza
`ForbiddenError` si el actor no es admin, `ArgumentError` si el rol no existe y
`LastAdminError` si dejaría el sistema sin admins. Devuelve `nothing` si el usuario
destino no existe.
"""
function change_user_role(users::UserRepository, actor_id, target_id, role::Symbol)
    require_admin(users, actor_id)
    role in USER_ROLES || throw(ArgumentError("role must be one of $(join(USER_ROLES, ", "))"))
    # El repositorio vuelve a verificar al actor dentro de la operación atómica.
    return set_user_role(users, target_id, role; actor_id)
end

"""
    admin_summary(users::UserRepository, prices::PriceRepository) -> NamedTuple

Resumen para la portada de /admin: cantidad de usuarios y de admins, activos, filas de
precios guardadas y la última importación (`nothing` si no hubo ninguna).
"""
function admin_summary(users::UserRepository, prices::PriceRepository)
    all_users = list_users(users)
    assets = list_assets(prices)
    last_import = list_imports(prices; limit=1)
    return (users=length(all_users), admins=count(user -> user.role == :admin, all_users),
            assets=length(assets), price_rows=sum((asset.price_rows for asset in assets); init=0),
            last_import=isempty(last_import) ? nothing : only(last_import))
end

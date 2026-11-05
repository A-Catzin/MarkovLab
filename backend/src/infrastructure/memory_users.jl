"""
    InMemoryUserRepository()

Adaptador de usuarios en memoria, con las mismas reglas que la tabla `usuarios`:
un usuario por `subject` y correo único. Sirve para las pruebas; los datos se pierden
al cerrar el proceso.
"""
struct InMemoryUserRepository <: UserRepository
    by_subject::Dict{String,AppUser}
    lock::ReentrantLock
end

InMemoryUserRepository() = InMemoryUserRepository(Dict{String,AppUser}(), ReentrantLock())

# UUID versión 4 a partir de 128 bits aleatorios, con los bits de versión y variante fijos.
function random_uuid()
    bits = rand(UInt128)
    bits = (bits & ~(UInt128(0xf) << 76)) | (UInt128(4) << 76)
    bits = (bits & ~(UInt128(0x3) << 62)) | (UInt128(0x2) << 62)
    return string(Base.UUID(bits))
end

function save_google_user(users::InMemoryUserRepository, profile::GoogleProfile)
    lock(users.lock) do
        current = Base.get(users.by_subject, profile.subject, nothing)
        for (subject, user) in users.by_subject
            subject != profile.subject && user.email == profile.email && throw(EmailConflictError(profile.email))
        end
        id = current === nothing ? random_uuid() : current.id
        role = current === nothing ? :user : current.role
        return users.by_subject[profile.subject] = AppUser(id, profile.email, profile.name, role)
    end
end

function find_user(users::InMemoryUserRepository, id)
    is_uuid(id) || return nothing
    lock(users.lock) do
        index = findfirst(user -> user.id == lowercase(id), users.by_subject)
        return index === nothing ? nothing : users.by_subject[index]
    end
end

# En memoria el orden de alta es el orden de los ids generados; basta ordenar por correo.
list_users(users::InMemoryUserRepository) = lock(() -> sort!(collect(values(users.by_subject)); by=u -> u.email), users.lock)

function set_user_role(users::InMemoryUserRepository, id, role::Symbol; actor_id=nothing)
    role in USER_ROLES || throw(ArgumentError("role must be one of $(join(USER_ROLES, ", "))"))
    lock(users.lock) do
        if actor_id !== nothing
            actor = is_uuid(actor_id) ? findfirst(user -> user.id == lowercase(actor_id), users.by_subject) : nothing
            (actor !== nothing && users.by_subject[actor].role == :admin) ||
                throw(ForbiddenError("admin role required"))
        end
        subject = is_uuid(id) ? findfirst(user -> user.id == lowercase(id), users.by_subject) : nothing
        subject === nothing && return nothing
        current = users.by_subject[subject]
        admins = count(user -> user.role == :admin, values(users.by_subject))
        current.role == :admin && role != :admin && admins <= 1 && throw(LastAdminError())
        return users.by_subject[subject] = AppUser(current.id, current.email, current.display_name, role)
    end
end

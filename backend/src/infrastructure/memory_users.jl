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
        return users.by_subject[profile.subject] = AppUser(id, profile.email, profile.name)
    end
end

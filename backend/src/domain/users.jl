# Usuarios de la aplicación. El inicio de sesión lo hace Google a través del frontend
# (Auth.js); el backend solo recibe el perfil ya verificado y lo guarda o actualiza.

const EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+$"
const MAX_GOOGLE_SUBJECT_LENGTH = 255

"""
    GoogleProfile(subject, email, name)

Perfil de Google ya verificado por el frontend. `subject` es el identificador estable
de la cuenta ("sub" del token de Google), `email` el correo y `name` el nombre visible
o `nothing`. El constructor recorta espacios, pasa el correo a minúsculas, convierte un
nombre vacío en `nothing` y lanza `ArgumentError` si el `subject` está vacío o es
demasiado largo, si el correo no tiene la forma `usuario@dominio`, o si algún campo
trae caracteres de control (PostgreSQL recortaría el texto en un NUL).
"""
struct GoogleProfile
    subject::String
    email::String
    name::Union{Nothing,String}

    function GoogleProfile(subject::AbstractString, email::AbstractString, name::Union{Nothing,AbstractString})
        for (field, value) in (("google_sub", subject), ("email", email), ("name", something(name, "")))
            any(iscntrl, value) && throw(ArgumentError("$field must not contain control characters"))
        end
        subject = strip(subject)
        isempty(subject) && throw(ArgumentError("google_sub must not be empty"))
        length(subject) > MAX_GOOGLE_SUBJECT_LENGTH &&
            throw(ArgumentError("google_sub must have at most $MAX_GOOGLE_SUBJECT_LENGTH characters"))
        email = lowercase(strip(email))
        occursin(EMAIL_PATTERN, email) || throw(ArgumentError("email must look like user@domain"))
        name = name === nothing ? nothing : strip(name)
        return new(String(subject), String(email), name === nothing || isempty(name) ? nothing : String(name))
    end
end

"""
Roles de la aplicación: `:user` (todo el que entra con Google; en la base, `usuario`) y
`:admin` (además administra activos, importaciones y usuarios).
"""
const USER_ROLES = (:user, :admin)

# Un UUID en texto (8-4-4-4-12 hexadecimales), para no mandar a la base ids mal formados.
const UUID_PATTERN = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
is_uuid(value) = value isa AbstractString && occursin(UUID_PATTERN, value)

"""
    AppUser(id, email, display_name, role=:user)

Usuario guardado en la base (tabla `usuarios`). `id` es el UUID en texto y `role` uno de
[`USER_ROLES`](@ref).
"""
struct AppUser
    id::String
    email::String
    display_name::Union{Nothing,String}
    role::Symbol

    function AppUser(id::AbstractString, email::AbstractString, display_name::Union{Nothing,AbstractString},
                     role::Symbol=:user)
        role in USER_ROLES || throw(ArgumentError("role must be one of $(join(USER_ROLES, ", ")), got $role"))
        return new(String(id), String(email), display_name === nothing ? nothing : String(display_name), role)
    end
end

"""
    parse_role(value) -> Symbol

Convierte el rol que llega por la API (`"user"` o `"admin"`) en un símbolo de
[`USER_ROLES`](@ref); cualquier otro valor lanza `ArgumentError`.
"""
function parse_role(value::AbstractString)
    role = Symbol(lowercase(strip(value)))
    role in USER_ROLES || throw(ArgumentError("role must be one of $(join(USER_ROLES, ", "))"))
    return role
end

"""
    ForbiddenError(message)

Quien hace la solicitud no tiene permiso: no existe o no es admin.
"""
struct ForbiddenError <: Exception
    message::String
end

Base.showerror(io::IO, err::ForbiddenError) = print(io, "ForbiddenError: ", err.message)

"""
    LastAdminError()

Se intentó quitar el rol al último admin: el sistema siempre conserva al menos uno.
"""
struct LastAdminError <: Exception end

Base.showerror(io::IO, ::LastAdminError) = print(io, "LastAdminError: the last admin cannot lose the admin role")

"""
    EmailConflictError(email)

El correo ya pertenece a otro usuario con una cuenta de Google distinta.
"""
struct EmailConflictError <: Exception
    email::String
end

Base.showerror(io::IO, err::EmailConflictError) =
    print(io, "EmailConflictError: the email ", err.email, " belongs to another account")

"""
Puerto de persistencia de usuarios. Cada adaptador implementa:

- `save_google_user(repository, profile::GoogleProfile) -> AppUser`: crea el usuario
  (con rol `:user`) o actualiza el que tiene el mismo `subject` sin tocar su rol. Lanza
  `EmailConflictError` si el correo ya pertenece a otro usuario.
- `find_user(repository, id) -> Union{AppUser,Nothing}`: el usuario con ese id, o
  `nothing` si no existe o el id no es un UUID.
- `list_users(repository) -> Vector{AppUser}`: todos, del más antiguo al más nuevo.
- `set_user_role(repository, id, role; actor_id=nothing) -> Union{AppUser,Nothing}`: cambia
  el rol en una operación atómica; lanza `LastAdminError` si dejaría el sistema sin admins y
  devuelve `nothing` si el usuario no existe. Con `actor_id`, dentro de la misma operación
  verifica que el actor siga siendo admin (`ForbiddenError` si no), para que nadie actúe
  con un rol que acaba de perder en un cambio simultáneo.
"""
abstract type UserRepository end

function save_google_user end
function find_user end
function list_users end
function set_user_role end

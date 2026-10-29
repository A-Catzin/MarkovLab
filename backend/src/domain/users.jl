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
    AppUser(id, email, display_name)

Usuario guardado en la base (tabla `usuarios`). `id` es el UUID en texto.
"""
struct AppUser
    id::String
    email::String
    display_name::Union{Nothing,String}
end

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
Puerto de persistencia de usuarios. Cada adaptador implementa
`save_google_user(repository, profile::GoogleProfile) -> AppUser`, que crea el usuario
o actualiza el que tiene el mismo `subject`, y lanza `EmailConflictError` si el correo
ya pertenece a otro usuario.
"""
abstract type UserRepository end

function save_google_user end

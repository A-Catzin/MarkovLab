"""
    sync_google_user(users::UserRepository, profile::GoogleProfile) -> AppUser

Caso de uso del inicio de sesión: guarda el usuario de Google la primera vez que
entra y, en las siguientes, actualiza su correo y su nombre. El usuario se identifica
por `profile.subject`, que Google mantiene aunque cambie el correo. Lanza
`EmailConflictError` si el correo ya pertenece a otra cuenta.
"""
sync_google_user(users::UserRepository, profile::GoogleProfile) = save_google_user(users, profile)

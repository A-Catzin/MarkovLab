using Test
using LibPQ
using MarkovLabBackend

# Prueba de integración contra un PostgreSQL real con la tabla `usuarios` (correo único sin
# distinguir mayúsculas).
# Solo corre si se define TEST_DATABASE_URL; usa una transacción por cada prueba que
# se revierte al final, así que no deja datos en la base.
@testset "PostgresUserRepository" begin
    url = Base.get(ENV, "TEST_DATABASE_URL", "")
    if isempty(url)
        @info "TEST_DATABASE_URL is not set; skipping PostgreSQL integration tests"
        @test_skip false
    else
        users = PostgresUserRepository(url)
        conn = MarkovLabBackend.connection!(users)
        LibPQ.execute(conn, "BEGIN")
        try
            created = sync_google_user(users, GoogleProfile("it-sub-1", "it.ana@example.com", "Ana"))
            @test length(created.id) == 36
            @test created.email == "it.ana@example.com"

            updated = sync_google_user(users, GoogleProfile("it-sub-1", "it.ana2@example.com", nothing))
            @test updated.id == created.id
            @test updated.email == "it.ana2@example.com"
            @test updated.display_name === nothing

            @test_throws EmailConflictError sync_google_user(users, GoogleProfile("it-sub-2", "IT.ANA2@example.com", "X"))
        finally
            LibPQ.execute(conn, "ROLLBACK")
        end

        # Si el servidor corta la conexión (reinicio o inactividad), el siguiente uso reconecta
        # y reintenta una vez, en lugar de fallar el inicio de sesión.
        try
            pid = only(LibPQ.columntable(LibPQ.execute(MarkovLabBackend.connection!(users), "SELECT pg_backend_pid() AS pid")).pid)
            admin = LibPQ.Connection(url)
            LibPQ.execute(admin, "SELECT pg_terminate_backend(\$1)", [pid])
            close(admin)
            user = sync_google_user(users, GoogleProfile("it-sub-3", "it.reconnect@example.com", nothing))
            @test user.email == "it.reconnect@example.com"
        finally
            LibPQ.execute(MarkovLabBackend.connection!(users), "DELETE FROM usuarios WHERE google_sub = 'it-sub-3'")
            close(users)
        end
    end
end

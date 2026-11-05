using Test
using LibPQ
using MarkovLabBackend

# Prueba de integración contra un PostgreSQL real con el esquema oficial
# (database/migrations/esquema.sql).
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

        # Roles: todo usuario nuevo es 'usuario' y el cambio de rol es atómico. `set_user_role`
        # usa su propia transacción, así que aquí no hay transacción externa: los usuarios de
        # prueba se borran al final. La regla del último admin solo se prueba si la base empieza
        # sin admins (nunca se les quita el rol a usuarios que ya existían).
        conn = MarkovLabBackend.connection!(users)
        admins_before = only(LibPQ.columntable(LibPQ.execute(conn, "SELECT count(*) AS n FROM usuarios WHERE rol = 'admin'")).n)
        try
            ana = sync_google_user(users, GoogleProfile("it-role-1", "it.role1@example.com", "Ana"))
            beto = sync_google_user(users, GoogleProfile("it-role-2", "it.role2@example.com", "Beto"))
            @test ana.role == :user
            @test find_user(users, ana.id) == ana
            @test find_user(users, "00000000-0000-4000-8000-000000000000") === nothing
            @test find_user(users, "not-a-uuid") === nothing

            @test set_user_role(users, ana.id, :admin).role == :admin
            # Volver a entrar no cambia el rol.
            @test sync_google_user(users, GoogleProfile("it-role-1", "it.role1@example.com", "Ana L.")).role == :admin
            if admins_before == 0
                @test_throws LastAdminError set_user_role(users, ana.id, :user)
                @test find_user(users, ana.id).role == :admin
            else
                @test_skip "the database already had admins; last-admin rule not exercised"
            end
            @test set_user_role(users, beto.id, :admin).role == :admin
            @test set_user_role(users, ana.id, :user).role == :user
            @test set_user_role(users, "00000000-0000-4000-8000-000000000000", :admin) === nothing
            @test any(u -> u.id == beto.id && u.role == :admin, list_users(users))
        finally
            conn = MarkovLabBackend.connection!(users)
            LibPQ.execute(conn, "DELETE FROM usuarios WHERE google_sub IN ('it-role-1', 'it-role-2')")
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

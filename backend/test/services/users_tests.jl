using Test
using MarkovLabBackend

@testset "Google users" begin
    @testset "GoogleProfile validates and normalizes" begin
        profile = GoogleProfile("  1234567890 ", " Ana@Example.com ", "  Ana López ")
        @test profile.subject == "1234567890"
        @test profile.email == "ana@example.com"
        @test profile.name == "Ana López"

        @test GoogleProfile("1", "a@b.co", nothing).name === nothing
        @test GoogleProfile("1", "a@b.co", "   ").name === nothing

        @test_throws ArgumentError GoogleProfile("", "a@b.co", nothing)
        @test_throws ArgumentError GoogleProfile("   ", "a@b.co", nothing)
        @test_throws ArgumentError GoogleProfile("x"^256, "a@b.co", nothing)
        @test_throws ArgumentError GoogleProfile("1", "not-an-email", nothing)
        @test_throws ArgumentError GoogleProfile("1", "a b@c.co", nothing)
        # Los caracteres de control (como NUL) se rechazan: PostgreSQL recortaría el texto.
        @test_throws ArgumentError GoogleProfile("s5\0", "a@b.co", nothing)
        @test_throws ArgumentError GoogleProfile("1", "a@b.co\0", nothing)
        @test_throws ArgumentError GoogleProfile("1", "a@b.co", "Ana\u0007")
    end

    @testset "sync_google_user creates, then updates the same user" begin
        users = InMemoryUserRepository()
        created = sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana"))
        @test created isa AppUser
        @test !isempty(created.id)
        @test created.email == "ana@example.com"
        @test created.display_name == "Ana"

        # El mismo `sub` de Google actualiza el correo y el nombre, sin crear otro usuario.
        updated = sync_google_user(users, GoogleProfile("sub-1", "ana.lopez@example.com", "Ana López"))
        @test updated.id == created.id
        @test updated.email == "ana.lopez@example.com"
        @test updated.display_name == "Ana López"
        @test length(users.by_subject) == 1

        other = sync_google_user(users, GoogleProfile("sub-2", "beto@example.com", nothing))
        @test other.id != created.id
        @test other.display_name === nothing
    end

    @testset "PostgresUserRepository only accepts postgresql:// URLs and never echoes them" begin
        @test PostgresUserRepository("postgresql://u:p@localhost:5432/db") isa PostgresUserRepository
        @test PostgresUserRepository("postgres://u:p@localhost/db") isa PostgresUserRepository
        # Usuario `postgres` a secas (conexión directa) y clave con %2C (coma codificada).
        @test PostgresUserRepository("postgresql://postgres:pw@db.ref.supabase.co:5432/postgres") isa PostgresUserRepository
        @test PostgresUserRepository("postgresql://postgres.ref:a%2Cb@aws-0-us-east-1.pooler.supabase.com:5432/postgres") isa PostgresUserRepository
        for bad in ("", "   ", "postgresql:postgresql://u:secret@host/db", "host=localhost password=secret", "postgresql://u:se cret@host/db")
            err = try
                PostgresUserRepository(bad)
                nothing
            catch e
                e
            end
            @test err isa ArgumentError
            # El mensaje nunca repite la URL, porque contiene la contraseña.
            @test !occursin("secret", sprint(showerror, err))
        end
    end

    @testset "only lost connections are retried, not SQL errors" begin
        errors = MarkovLabBackend.LibPQ.Errors
        @test MarkovLabBackend.is_connection_error(errors.AdminShutdown("closed", "closed"))
        @test MarkovLabBackend.is_connection_error(errors.PQConnectionError("network unreachable"))
        # Error sin código SQLSTATE: es lo que llega cuando el servidor cortó la conexión.
        @test MarkovLabBackend.is_connection_error(errors.PQResultError{errors.CUN,errors.EUNOWN}("lost", "lost"))
        # Una tabla que no existe o un conflicto son errores de SQL: reintentar no sirve.
        @test !MarkovLabBackend.is_connection_error(errors.UndefinedTable("no table", "no table"))
        @test !MarkovLabBackend.is_connection_error(errors.UniqueViolation("dup", "dup"))
        @test !MarkovLabBackend.is_connection_error(ArgumentError("x"))
    end

    @testset "an email owned by another Google account is a conflict" begin
        users = InMemoryUserRepository()
        sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana"))
        err = try
            sync_google_user(users, GoogleProfile("sub-2", "ANA@example.com", "Otra Ana"))
            nothing
        catch e
            e
        end
        @test err isa EmailConflictError
        @test err.email == "ana@example.com"
        @test length(users.by_subject) == 1
    end
end

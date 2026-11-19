using Test
using LibPQ
using MarkovLabBackend

# Prueba de integración de la conexión compartida (`run_query`, `with_connection`) contra
# un PostgreSQL real. Solo corre si se define TEST_DATABASE_URL; no escribe datos.
@testset "PostgresConnection" begin
    url = Base.get(ENV, "TEST_DATABASE_URL", "")
    if isempty(url)
        @info "TEST_DATABASE_URL is not set; skipping PostgreSQL connection tests"
        @test_skip false
    else
        run_query = MarkovLabBackend.run_query
        db = MarkovLabBackend.PostgresConnection(url)
        other = MarkovLabBackend.PostgresConnection(url)
        try
            @testset "run_query returns the result of a parameterized query" begin
                result = run_query(MarkovLabBackend.connection!(db), "SELECT \$1::int + 1 AS n", [41])
                @test only(LibPQ.columntable(result).n) == 42
            end

            if Sys.islinux()
                @testset "the socket gives up on unacknowledged data after 20 s" begin
                    # libpq acepta tcp_user_timeout en la URL pero no lo aplica al socket
                    # (visto el 2026-11-17: TCP_USER_TIMEOUT quedaba en 0); se pone a mano.
                    conn = MarkovLabBackend.connection!(db)
                    fd = MarkovLabBackend.LibPQ.libpq_c.PQsocket(conn.conn)
                    value, len = Ref{Cint}(0), Ref{Cuint}(sizeof(Cint))
                    @test ccall(:getsockopt, Cint, (Cint, Cint, Cint, Ptr{Cint}, Ptr{Cuint}),
                                fd, 6, 18, value, len) == 0   # IPPROTO_TCP, TCP_USER_TIMEOUT
                    @test value[] == 20_000
                end
            end

            @testset "SQL errors come out as the LibPQ error, not wrapped in a task" begin
                err = try
                    run_query(MarkovLabBackend.connection!(db), "SELECT * FROM no_such_table")
                    nothing
                catch e
                    e
                end
                @test err isa LibPQ.Errors.UndefinedTable
                @test !MarkovLabBackend.is_connection_error(err)
            end

            @testset "a dropped connection is recognized and with_connection reconnects" begin
                pid = only(LibPQ.columntable(run_query(MarkovLabBackend.connection!(db), "SELECT pg_backend_pid() AS pid")).pid)
                run_query(MarkovLabBackend.connection!(other), "SELECT pg_terminate_backend(\$1)", [pid])
                err = try
                    run_query(db.conn, "SELECT 1")
                    nothing
                catch e
                    e
                end
                @test err isa LibPQ.Errors.LibPQException
                @test MarkovLabBackend.is_connection_error(err)

                # Se vuelve a cortar y esta vez la consulta pasa por with_connection.
                pid = only(LibPQ.columntable(MarkovLabBackend.with_connection(
                    conn -> run_query(conn, "SELECT pg_backend_pid() AS pid"), db)).pid)
                run_query(MarkovLabBackend.connection!(other), "SELECT pg_terminate_backend(\$1)", [pid])
                n = MarkovLabBackend.with_connection(conn -> only(LibPQ.columntable(run_query(conn, "SELECT 7 AS n")).n), db)
                @test n == 7
            end

            @testset "waiting for the database does not freeze other tasks" begin
                # Calienta las dos conexiones para que la medición no incluya compilación.
                run_query(MarkovLabBackend.connection!(db), "SELECT 1")
                run_query(MarkovLabBackend.connection!(other), "SELECT 1")
                started = time()
                slow = @async run_query(db.conn, "SELECT pg_sleep(1.5)")
                yield()
                # Mientras la consulta lenta espera, otra conexión responde y el hilo sigue libre.
                run_query(other.conn, "SELECT 1")
                elapsed = time() - started
                @test elapsed < 1.0
                @test !istaskdone(slow)
                wait(slow)
                @test time() - started >= 1.5
            end
        finally
            close(db)
            close(other)
        end
    end
end

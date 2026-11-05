using Test
using MarkovLabBackend

@testset "Roles" begin
    @testset "new users are plain users" begin
        users = InMemoryUserRepository()
        user = sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana"))
        @test user.role == :user
        @test find_user(users, user.id) == user
        @test find_user(users, "00000000-0000-4000-8000-000000000000") === nothing
        @test find_user(users, "not-a-uuid") === nothing
    end

    @testset "signing in again keeps the role" begin
        users = InMemoryUserRepository()
        user = sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana"))
        set_user_role(users, user.id, :admin)
        again = sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana L."))
        @test again.role == :admin
        @test again.display_name == "Ana L."
    end

    @testset "only an admin can change roles, and never the last admin away" begin
        users = InMemoryUserRepository()
        ana = sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana"))
        beto = sync_google_user(users, GoogleProfile("sub-2", "beto@example.com", "Beto"))
        set_user_role(users, ana.id, :admin)

        # Un usuario normal no puede cambiar roles.
        @test_throws ForbiddenError change_user_role(users, beto.id, beto.id, :admin)
        @test_throws ForbiddenError change_user_role(users, "unknown", beto.id, :admin)

        promoted = change_user_role(users, ana.id, beto.id, :admin)
        @test promoted.role == :admin
        @test length(filter(u -> u.role == :admin, list_users(users))) == 2

        # Con dos admins, uno puede bajar al otro (o a sí mismo).
        @test change_user_role(users, beto.id, ana.id, :user).role == :user

        # Beto quedó como único admin: no puede quitarse el rol.
        err = try
            change_user_role(users, beto.id, beto.id, :user)
            nothing
        catch e
            e
        end
        @test err isa LastAdminError
        @test find_user(users, beto.id).role == :admin

        # Dentro de la operación atómica también se verifica al actor: Ana ya no es admin.
        @test_throws ForbiddenError set_user_role(users, beto.id, :user; actor_id=ana.id)
        @test find_user(users, beto.id).role == :admin

        @test_throws ArgumentError change_user_role(users, beto.id, ana.id, :superuser)
        @test change_user_role(users, beto.id, "00000000-0000-4000-8000-000000000000", :admin) === nothing
    end

    @testset "admin pages read the catalog and the import history" begin
        users = InMemoryUserRepository()
        prices = InMemoryPriceRepository()
        admin = sync_google_user(users, GoogleProfile("sub-1", "ana@example.com", "Ana"))
        set_user_role(users, admin.id, :admin)
        csv = "Date,Open,High,Low,Close,Volume,Symbol\n2024-06-10,1,2,0.5,1.5,10,AAPL\n2024-06-11,1,2,0.5,1.6,10,AAPL\n"
        import_prices(prices, IOBuffer(csv), AssetDetails("Apple", "NASDAQ", "Acción", "USD"))

        assets = list_assets(prices)
        @test length(assets) == 1
        @test only(assets).symbol == "AAPL"
        @test only(assets).price_rows == 2
        @test string(only(assets).first_date) == "2024-06-10"
        @test string(only(assets).last_date) == "2024-06-11"

        imports = list_imports(prices; limit=10)
        @test only(imports).status == :success
        @test only(imports).asset_symbol == "AAPL"
        @test only(imports).saved == 2

        summary = admin_summary(users, prices)
        @test summary.users == 1 && summary.admins == 1
        @test summary.assets == 1 && summary.price_rows == 2
        @test summary.last_import.status == :success
    end
end

# Pruebas

Responsabilidad: verificar el comportamiento observable del paquete Julia. `runtests.jl` comprueba que el módulo carga, verifica la carga de trabajo `precompile_workload` sin estado residual e incluye las pruebas de cada capa: `domain/` (métricas, `PriceBar`, carteras, simulación, historia de carteras y tipos de cambio), `services/` (análisis, riesgo, usuarios, importación CSV, roles, carteras, sincronización de mercado y simulaciones), `api/` (endpoints públicos y rutas internas de usuarios, admin, carteras y simulaciones) e `infrastructure/` (CSV, Apify y PostgreSQL); `fixtures/` guarda archivos de ejemplo pequeños y sin datos sensibles. Las pruebas nuevas se ubican en una carpeta con el nombre de la capa y se incluyen desde `runtests.jl`.

Contenido permitido: pruebas deterministas del paquete y, cuando existan componentes, de sus límites. Límite: no alojar lógica de producción ni depender de servicios o credenciales reales. Ejecute `julia --project=backend backend/test/runtests.jl` desde la raíz.

Las pruebas de integración con PostgreSQL (`infrastructure/postgres_*_tests.jl`) solo corren con `TEST_DATABASE_URL`, contra una base con el esquema oficial, [`database/migrations/esquema.sql`](../../database/migrations/esquema.sql) y sus migraciones `0002` a `0004`. Para levantarla con Docker:

```bash
docker run -d --rm --name mlab-pg -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:15-alpine
for f in esquema.sql 0002_cierre_ajustado.sql 0003_roles.sql 0004_tipos_cambio.sql; do
  psql "postgresql://postgres:test@localhost:55432/postgres" -v ON_ERROR_STOP=1 -f database/migrations/$f
done
TEST_DATABASE_URL="postgresql://postgres:test@localhost:55432/postgres" julia --project=backend backend/test/runtests.jl
```

Nunca apunte `TEST_DATABASE_URL` a la base real: las pruebas crean y borran datos.

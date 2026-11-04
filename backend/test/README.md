# Pruebas

Responsabilidad: verificar el comportamiento observable del paquete Julia. `runtests.jl` comprueba que el módulo carga e incluye las pruebas de cada capa; `domain/` verifica las métricas financieras y los invariantes de `PriceBar`; `infrastructure/` verifica la importación CSV; `fixtures/` guarda archivos de ejemplo pequeños y sin datos sensibles. Las pruebas nuevas se ubican en una carpeta con el nombre de la capa y se incluyen desde `runtests.jl`.

Contenido permitido: pruebas deterministas del paquete y, cuando existan componentes, de sus límites. Límite: no alojar lógica de producción ni depender de servicios o credenciales reales. Ejecute `julia --project=backend backend/test/runtests.jl` desde la raíz.

Las pruebas de integración con PostgreSQL (`infrastructure/postgres_*_tests.jl`) solo corren con `TEST_DATABASE_URL`, contra una base con el esquema oficial, [`database/migrations/esquema.sql`](../../database/migrations/esquema.sql), que es idéntico al de Supabase. Para levantarla con Docker:

```bash
docker run -d --rm --name mlab-pg -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:15-alpine
psql "postgresql://postgres:test@localhost:55432/postgres" -f database/migrations/esquema.sql
TEST_DATABASE_URL="postgresql://postgres:test@localhost:55432/postgres" julia --project=backend backend/test/runtests.jl
``` Nunca apunte `TEST_DATABASE_URL` a la base real: las pruebas crean y borran datos.

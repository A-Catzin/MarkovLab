# Infraestructura

## Overview

Responsabilidad: adaptar archivos CSV, almacenamiento en memoria y PostgreSQL a las necesidades de los servicios y puertos del dominio.

Contenido permitido: conectores, repositorios y traducciones de datos externos. Límite: no exponer HTTP ni decidir reglas financieras; tampoco guardar credenciales en código. Ver [`IMPORTACION_CSV.md`](../../../documentacion/tecnica/IMPORTACION_CSV.md).

## Interface

- **Importación CSV de precios (`csv_prices.jl`)**:
  - `ImportIssue(line, message)` (`[csv_prices.jl:ImportIssue]`), `PriceImportResult(bars, errors, duplicates)` (`[csv_prices.jl:PriceImportResult]`).
  - `parse_prices_csv(io; columns=Dict(), symbol=nothing) -> PriceImportResult` (`[csv_prices.jl:parse_prices_csv]`).
  - `read_prices_csv(path; kwargs...) -> PriceImportResult` (`[csv_prices.jl:read_prices_csv]`).
  - Constantes: `PRICE_COLUMNS` (`("symbol", "date", "open", "high", "low", "close", "volume")`), `PRICE_DATE_FORMAT` (`dateformat"yyyy-mm-dd"`) (`[csv_prices.jl:PRICE_COLUMNS]`, `[csv_prices.jl:PRICE_DATE_FORMAT]`).
- **Repositorio de usuarios en memoria (`memory_users.jl`)**:
  - `InMemoryUserRepository()` (`[memory_users.jl:InMemoryUserRepository]`), `save_google_user(users::InMemoryUserRepository, profile::GoogleProfile) -> AppUser` (`[memory_users.jl:save_google_user]`).
- **Conexión PostgreSQL compartida (`postgres.jl`)**:
  - `PostgresConnection(url)`, `connection!(db)`, `Base.close(db)`, `with_connection(f, db)` (reintenta una vez ante conexión perdida), `in_transaction(f, conn)` (`BEGIN`/`COMMIT`/`ROLLBACK`), `is_connection_error(err)` y `DATABASE_URL_PATTERN` (`[postgres.jl:PostgresConnection]`, `[postgres.jl:with_connection]`, `[postgres.jl:in_transaction]`).
- **Repositorio de precios en memoria (`memory_prices.jl`)**:
  - `InMemoryPriceRepository()` y `save_price_import(prices, symbol, details, bars, status, failed_rows, message) -> (asset_id, inserted)` (`[memory_prices.jl:save_price_import]`).
- **Repositorio de precios en PostgreSQL (`postgres_prices.jl`)**:
  - `PostgresPriceRepository(url)`, `save_price_import(...)` sobre `activos`, `precios_historicos` y `sincronizaciones` en una transacción (`[postgres_prices.jl:save_price_import]`).
- **Repositorio de usuarios en PostgreSQL (`postgres_users.jl`)**:
  - `PostgresUserRepository(url)` (`[postgres_users.jl:PostgresUserRepository]`), `connection!(users::PostgresUserRepository)` (`[postgres_users.jl:connection!]`), `Base.close(users::PostgresUserRepository)` (`[postgres_users.jl:close]`), `save_google_user(users::PostgresUserRepository, profile::GoogleProfile) -> AppUser` (`[postgres_users.jl:save_google_user]`), `UPSERT_GOOGLE_USER_SQL` (`[postgres_users.jl:UPSERT_GOOGLE_USER_SQL]`).

## Invariants

- `parse_prices_csv` exige un flujo CSV no vacío con las columnas obligatorias `PRICE_COLUMNS` (o `symbol` provisto por argumento), interpreta fechas con `PRICE_DATE_FORMAT` (`yyyy-mm-dd`), registra filas inválidas en `errors` y filas con `(symbol, date)` repetido en `duplicates` conservando la primera aparición, y devuelve `bars` ordenado por `(symbol, date)` (`[csv_prices.jl:PRICE_COLUMNS]`, `[csv_prices.jl:PRICE_DATE_FORMAT]`, `[csv_prices.jl:parse_prices_csv]`).
- `InMemoryUserRepository` y `PostgresUserRepository` garantizan un único `AppUser` por `google_sub` (`profile.subject`) y correo electrónico único entre cuentas distintas, lanzando `EmailConflictError` ante colisión de correo (`[memory_users.jl:save_google_user]`, `[postgres_users.jl:UPSERT_GOOGLE_USER_SQL]`, `[postgres_users.jl:save_google_user]`).
- `PostgresConnection` (que usan `PostgresUserRepository` y `PostgresPriceRepository`) rechaza con `ArgumentError` una `url` que no tenga la forma `postgresql://...`, sin repetirla en el mensaje; serializa el acceso a la conexión `LibPQ.Connection` con `ReentrantLock`, y reconecta reintentando una vez solo cuando la conexión se perdió (`is_connection_error`), no ante errores de SQL (`[postgres.jl:PostgresConnection]`, `[postgres.jl:with_connection]`).
- `PostgresPriceRepository` guarda el activo, los precios y el registro de la importación en una sola transacción; omite los precios ya existentes por `(activo_id, fecha_operacion, origen)` y no crea el activo si no hay barras (`[postgres_prices.jl:save_price_import]`).

## Side Effects

- `read_prices_csv` abre y lee archivos CSV del sistema de archivos local (`[csv_prices.jl:read_prices_csv]`).
- `InMemoryUserRepository` toma un `ReentrantLock`, genera UUID v4 aleatorios (`rand(UInt128)`) y modifica el diccionario en memoria `by_subject` (`[memory_users.jl:random_uuid]`, `[memory_users.jl:save_google_user]`).
- `PostgresPriceRepository` inserta y actualiza filas en `activos`, inserta en `precios_historicos` y `sincronizaciones` (`[postgres_prices.jl:save_price_import]`).
- `PostgresUserRepository` toma un `ReentrantLock`, abre y cierra conexiones TCP hacia PostgreSQL mediante `LibPQ.Connection` y ejecuta `INSERT INTO usuarios ... ON CONFLICT (google_sub) DO UPDATE` (`[postgres_users.jl:connection!]`, `[postgres_users.jl:close]`, `[postgres_users.jl:UPSERT_GOOGLE_USER_SQL]`, `[postgres_users.jl:save_google_user]`).

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

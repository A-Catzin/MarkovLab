# Scripts

## Overview

Responsabilidad: reunir tareas locales reproducibles de desarrollo del backend.

Contenido permitido: scripts explícitos y documentados para tareas no destructivas. Límite: no implementar reglas de negocio, almacenar secretos ni ejecutar migraciones implícitas.

```bash
julia --project=backend backend/scripts/serve.jl
julia --project=backend backend/scripts/import_prices.jl datos/AAPL.csv --nombre "Apple Inc." --mercado NASDAQ --categoria Acción --moneda USD
julia --project=backend backend/scripts/sync_prices.jl AAPL WALMEX.MX --desde 2000-01-01
```

Las pruebas se ejecutan directamente con Julia según [`backend/README.md`](../README.md).

## Interface

- `serve.jl` (`[serve.jl:MarkovLabBackend.Api.start]`): Script de inicio que carga `MarkovLabBackend` e invoca `MarkovLabBackend.Api.start()` con la configuración documentada en [`../config/README.md`](../config/README.md).

- `import_prices.jl` (`[import_prices.jl:main]`): carga un CSV de un activo a la base con `import_prices` y `PostgresPriceRepository`, e imprime un resumen. Detalle en [`IMPORTACION_CSV.md`](../../documentacion/tecnica/IMPORTACION_CSV.md#cargar-un-csv-a-la-base).
- `sync_prices.jl` (`[sync_prices.jl:main]`): trae precios diarios desde Apify (Yahoo Finance) con `sync_market_prices` y `ApifyMarketData`: carga histórica con `--desde`, actualización sin ella, o `--catalogo` para todos los activos. Detalle en [`PRECIOS_API.md`](../../documentacion/tecnica/PRECIOS_API.md).

## Invariants

- Los scripts solo invocan puntos de entrada públicos del paquete `MarkovLabBackend` y nunca contienen reglas financieras, credenciales ni migraciones implícitas (`[serve.jl:MarkovLabBackend.Api.start]`).

## Side Effects

- Carga `MarkovLabBackend` y ejecuta `MarkovLabBackend.Api.start()`, leyendo `HOST`, `PORT`, `ALLOWED_ORIGINS`, `DATABASE_URL` e `INTERNAL_API_KEY` de `ENV` e iniciando el servidor HTTP en bloqueo (`[serve.jl:MarkovLabBackend.Api.start]`).

- `import_prices.jl` lee `DATABASE_URL` y el archivo CSV indicado, y escribe en `activos`, `precios_historicos` y `sincronizaciones`. Sale con código 1 si la importación falla o faltan datos (`[import_prices.jl:main]`).
- `sync_prices.jl` lee `DATABASE_URL` y `APIFY_TOKEN`, llama a la API de Apify (cobra unos $0.0005 por símbolo y corrida) y escribe en las mismas tablas con origen `api`. Sale con código 1 si algún símbolo falló (`[sync_prices.jl:main]`).

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

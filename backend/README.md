# Backend Julia (`MarkovLabBackend`)

## Overview

Este directorio contiene el paquete `MarkovLabBackend`: cálculos financieros, simulación Monte Carlo de riesgo de carteras, importación de datos CSV, persistencia de usuarios Google y una API HTTP con Oxygen.jl. La organización y las conexiones previstas están en [`ARCHITECTURE.md`](../documentacion/tecnica/ARCHITECTURE.md) y el historial de cambios en [`CHANGELOG.md`](./CHANGELOG.md).

### Inicio rápido

Desde la raíz del repositorio, con Julia instalado:

```bash
julia --project=backend -e 'using Pkg; Pkg.instantiate()'   # primera vez
julia --project=backend -e 'using Pkg; Pkg.test()'          # pruebas del paquete
julia --project=backend backend/test/runtests.jl            # ejecución directa de pruebas
julia --project=backend backend/scripts/serve.jl            # API en http://localhost:8080
```

## Interface

- **Manifiesto del paquete (`Project.toml`)**:
  - Paquete `MarkovLabBackend` (`uuid = "a52f9f0b-3d56-471b-a712-a3e35b4c8cf2"`, `version = "0.1.0"`) con dependencias `Dates`, `HTTP`, `LibPQ`, `Oxygen` y `Random` (`[Project.toml:name]`, `[Project.toml:deps]`).
- **Subdirectorios y contratos**:
  - [`src`](./src/README.md): Módulo `MarkovLabBackend.jl` y sus capas [`src/domain`](./src/domain/README.md) ([`METRICAS_DOMINIO.md`](../documentacion/tecnica/METRICAS_DOMINIO.md), [`CARTERAS_DOMINIO.md`](../documentacion/tecnica/CARTERAS_DOMINIO.md), [`SIMULACION_RIESGO.md`](../documentacion/tecnica/SIMULACION_RIESGO.md)), [`src/infrastructure`](./src/infrastructure/README.md) ([`IMPORTACION_CSV.md`](../documentacion/tecnica/IMPORTACION_CSV.md)), [`src/services`](./src/services/README.md) y [`src/api`](./src/api/README.md) ([`API.md`](../documentacion/tecnica/API.md)).
  - [`scripts`](./scripts/README.md): Tareas locales reproducibles (`serve.jl`).
  - [`config`](./config/README.md): Documentación de variables de entorno (`HOST`, `PORT`, `ALLOWED_ORIGINS`, `DATABASE_URL`, `INTERNAL_API_KEY`).
  - [`test`](./test/README.md): Suite determinista de pruebas por capa (`runtests.jl`).

## Invariants

- `Project.toml` (`[Project.toml:compat]`) y `Manifest.toml` fijan las versiones resueltas para garantizar un entorno reproducible; nunca deben guardarse secretos ni credenciales en el repositorio (`backend/.env` está excluido en `.gitignore`).
- Separación estricta por capas: `src/domain` contiene únicamente modelos y cálculos puros sin E/S; `src/infrastructure` encapsula archivos CSV y PostgreSQL (`LibPQ`); `src/services` coordina casos de uso y límites operativos (`MAX_SIMULATIONS`, `MAX_HORIZON`); `src/api` traduce transporte HTTP/JSON y aplica CORS y autenticación interna (`X-Internal-Key`).

## Side Effects

- Iniciar el servidor mediante `scripts/serve.jl` o `MarkovLabBackend.Api.start()` lee variables de entorno (`ENV`), abre un socket HTTP con Oxygen/HTTP.jl y, cuando `DATABASE_URL` está configurada, abre conexiones `LibPQ` hacia PostgreSQL para sincronizar registros en `app_users`.
- La importación de archivos mediante `read_prices_csv` lee archivos CSV del sistema de archivos local.

## Verification

- Run: `julia --project=backend -e 'using Pkg; Pkg.test()'`

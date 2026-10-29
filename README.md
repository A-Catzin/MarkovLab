# MarkovLab Blueprint

## System Overview

MarkovLab es una plataforma académica para el análisis cuantitativo, simulación de riesgo y optimización de carteras financieras. Combina procesamiento numérico determinista en **Julia** con una interfaz web interactiva en **Next.js (App Router)** y persistencia relacional en **PostgreSQL** (administrado en Supabase).

> El proyecto tiene fines educativos y de investigación cuantitativa. No ejecuta órdenes financieras reales ni reemplaza el asesoramiento profesional.

Arquitectura general del sistema:
```text
Frontend (Next.js 15 + TypeScript)
        ↓ HTTP / JSON (CORS + X-Internal-Key)
Backend API (Julia 1.10+ con Oxygen.jl)
        ↓ LibPQ.jl
Base de Datos (PostgreSQL en Supabase)
```

La especificación funcional completa está en [`SRS.md`](./documentacion/contexto/SRS.md) y las decisiones arquitectónicas en [`ARCHITECTURE.md`](./documentacion/tecnica/ARCHITECTURE.md).

## Subdirectories & System Boundaries

- `backend`: [`./backend/README.md`](./backend/README.md) — Paquete Julia `MarkovLabBackend` que encapsula el dominio financiero puro, cálculo de métricas de rendimiento y riesgo (drawdowns, correlación, covarianza), simulación Monte Carlo determinista (`normal-rebalanced-v1`), importación de precios desde CSV, adaptadores de persistencia de usuarios Google y la API REST con Oxygen.jl.
- `frontend`: [`./frontend/README.md`](./frontend/README.md) — Aplicación web Next.js (App Router) con TypeScript y Tailwind CSS, incluyendo la landing page científica, un simulador de carteras en navegador con el mismo modelo Monte Carlo, autenticación OAuth mediante Auth.js y el dashboard del analista (`/app`).
- `database`: [`./database/README.md`](./database/README.md) — Estructura documental para el esquema relacional, migraciones y datos iniciales de PostgreSQL.
- `documentacion`: [`./documentacion/README.md`](./documentacion/README.md) — Documentación de requisitos (`contexto/SRS.md`), contratos técnicos (`tecnica/API.md`, `tecnica/ARCHITECTURE.md`, `tecnica/AUTENTICACION.md`, `tecnica/METRICAS_DOMINIO.md`, `tecnica/SIMULACION_RIESGO.md`) y datos (`datos/diccionario-datos.md`).

## Global Invariants

- **Separación de responsabilidades**: El frontend nunca consulta directamente la base de datos PostgreSQL ni almacena credenciales de mercado; todo el acceso a datos y cálculos pesados se coordina a través de la API en Julia.
- **Reproducibilidad numérica**: Los cálculos de métricas y simulaciones Monte Carlo emplean fórmulas auditadas y soportan semillas fijas (`Random.Xoshiro` en Julia, `mulberry32` en el navegador) para garantizar que los resultados sean reproducibles bajo las mismas condiciones.
- **Tolerancia y validación de carteras**: Las carteras financieras exigen que la suma de sus pesos sea estrictamente igual a `1.0` dentro de una tolerancia de `1e-6` (`PORTFOLIO_WEIGHT_TOLERANCE`), sin posiciones cortas salvo indicación explícita.
- **Seguridad de endpoints internos**: Las rutas privadas de sincronización entre Next.js y Julia (`POST /api/internal/users/google`) exigen el encabezado `X-Internal-Key` validado en tiempo constante contra `INTERNAL_API_KEY` (mínimo 32 caracteres).
- **Aislamiento de credenciales**: Variables de entorno (`DATABASE_URL`, `INTERNAL_API_KEY`, `GOOGLE_CLIENT_SECRET`) se configuran únicamente a través de archivos locales `.env` o variables del servidor, estando excluidas en `.gitignore`.

## Global Side Effects

- **Persistencia relacional**: Sincronización de perfiles Google en la tabla `app_users` mediante `LibPQ.jl`.
- **Servicio HTTP**: Binding de red del servidor Oxygen.jl en `HOST:PORT` (`http://localhost:8080` por defecto) y servidor Next.js en puerto `3000`.
- **Sistema de archivos**: Lectura y validación de series históricas de precios a partir de archivos CSV locales mediante `read_prices_csv`.

## System Verification

- Backend Julia:
  ```bash
  julia --project=backend -e 'using Pkg; Pkg.test()'
  ```
- Frontend Next.js:
  ```bash
  cd frontend && npm run typecheck && npm run build
  ```

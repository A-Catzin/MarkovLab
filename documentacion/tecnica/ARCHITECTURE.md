# Arquitectura y responsabilidades de MarkovLab

Este documento es la referencia de la estructura del proyecto. `README.md` introduce el proyecto; `SRS.md` define los requisitos. La estructura aquí descrita distingue lo existente de lo previsto.

## Límites y flujo previsto

| Área | Responsabilidad | Límite |
|---|---|---|
| Frontend (previsto) | Interfaz Next.js/TypeScript y visualizaciones. | No consulta directamente PostgreSQL ni almacena secretos. |
| `backend/` (base actual) | Paquete Julia; a futuro, API HTTP, cálculos y coordinación de datos. | No contiene interfaz ni esquema SQL. |
| Base de datos (prevista) | PostgreSQL administrado por Supabase: datos y resultados persistentes. | El acceso de negocio pasa por el backend. |
| Documentación | `README.md` orienta, `SRS.md` especifica requisitos y este archivo fija límites y estructura; los README locales detallan cada directorio. | No sustituye código ni servicios desplegados. |

Flujo futuro: usuario → frontend → solicitud HTTP/JSON al backend → validación y servicios → dominio e infraestructura (PostgreSQL o proveedor de mercado) → respuesta JSON → visualización. Supabase no sustituye la API Julia; la integración externa y las credenciales pertenecen al backend. **Hoy funciona el tramo HTTP → servicios → dominio** (ver [`API.md`](API.md)); la persistencia en PostgreSQL y el proveedor de mercado todavía no están integrados.

## Ramas y estabilidad

`main` permanece estable: integrar allí únicamente cambios revisados y comprobados. `feature/backend` es dueña del trabajo de backend; `feature/frontend-dashboard`, del frontend; `feature/db-migrations`, del esquema y migraciones de base de datos; `docs/manual-csv-datasets`, de documentación y conjuntos CSV manuales. Cada rama aísla su ámbito antes de la integración; esta descripción no implica que sus componentes ya estén implementados.

## Árbol del backend (base actual)

```text
backend/
├── README.md                 # Inicio y límites del paquete
├── CHANGELOG.md              # Registro de lo implementado
├── Project.toml              # Identidad, versión y dependencias Julia (Oxygen, HTTP, Dates, Random)
├── Manifest.toml             # Versiones resueltas del entorno
├── src/
│   ├── README.md             # Mapa del código fuente
│   ├── MarkovLabBackend.jl    # Módulo principal y exportaciones
│   ├── api/
│   │   ├── README.md         # Capa HTTP
│   │   ├── Api.jl            # Submódulo Api (Oxygen) y start()
│   │   ├── routes.jl         # Endpoints
│   │   ├── errors.jl         # Lectura de JSON y respuestas de error
│   │   └── cors.jl           # CORS por ALLOWED_ORIGINS
│   ├── domain/
│   │   ├── README.md         # Reglas y modelos puros
│   │   ├── errors.jl         # InsufficientDataError
│   │   ├── metrics.jl        # Rendimientos, volatilidad, drawdown y correlación
│   │   ├── prices.jl         # PriceBar (observación OHLCV)
│   │   ├── portfolio.jl      # Portfolio, covarianza y riesgo de cartera
│   │   └── simulation.jl     # Monte Carlo, VaR y CVaR
│   ├── services/
│   │   ├── README.md         # Casos de uso
│   │   ├── analysis.jl       # analyze_prices
│   │   └── risk.jl           # run_monte_carlo
│   └── infrastructure/
│       ├── README.md         # Adaptadores externos
│       └── csv_prices.jl     # Importación de precios desde CSV
├── test/
│   ├── README.md             # Estrategia de pruebas
│   ├── runtests.jl           # Punto de entrada de las pruebas
│   ├── domain/               # Pruebas de métricas, PriceBar, carteras y simulación
│   ├── infrastructure/       # Pruebas de importación CSV
│   ├── services/             # Pruebas de casos de uso
│   ├── api/                  # Pruebas de endpoints y CORS
│   └── fixtures/             # Archivos CSV de ejemplo
├── config/README.md          # Variables de entorno
└── scripts/
    ├── README.md             # Tareas locales
    └── serve.jl              # Inicia la API
```

`domain/` contiene las métricas financieras puras ([`METRICAS_DOMINIO.md`](METRICAS_DOMINIO.md)), `PriceBar` y las carteras ([`CARTERAS_DOMINIO.md`](CARTERAS_DOMINIO.md)); `infrastructure/` contiene el importador CSV ([`IMPORTACION_CSV.md`](IMPORTACION_CSV.md)). `services/` coordina los casos de uso y `api/` los expone por HTTP ([`API.md`](API.md)); `scripts/serve.jl` inicia el servidor. No hay migraciones, integración con PostgreSQL o la API de mercado ni Docker en esta base. Ver [`backend/README.md`](../../backend/README.md) para probar el paquete.

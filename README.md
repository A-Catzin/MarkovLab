# MarkovLab

MarkovLab es un proyecto académico para el monitoreo, análisis y optimización de carteras financieras. El sistema busca combinar datos de mercado, análisis estadístico, predicciones, simulaciones Monte Carlo y optimización reproducible.

> El proyecto tiene fines educativos. No ejecuta operaciones financieras ni reemplaza asesoramiento profesional.

## Estado

En desarrollo activo (etapa base). El paquete Julia [`MarkovLabBackend`](./backend/README.md) ya cuenta con el modelo de dominio de precios (`PriceBar`), métricas financieras puras (rendimientos, volatilidad, drawdown y correlación), importación validada desde CSV y pruebas unitarias automatizadas. Las capas de API HTTP, esquema SQL ([`database/`](./database/README.md)) e interfaz web ([`frontend/`](./frontend/README.md)) cuentan con su estructura base y documentación arquitectónica.

La especificación funcional completa está documentada en [`SRS.md`](./documentacion/contexto/SRS.md).

## Arquitectura prevista

La estructura y las conexiones previstas se describen en [`ARCHITECTURE.md`](./documentacion/tecnica/ARCHITECTURE.md).

```text
Frontend Next.js + TypeScript
            ↓ HTTP/JSON
API Julia con Oxygen.jl
            ↓
PostgreSQL administrado por Supabase
            ↓
Proveedor externo de datos de mercado
```

- **Frontend:** Next.js, TypeScript, Tailwind CSS, shadcn/ui y Apache ECharts.
- **Backend:** Julia y Oxygen.jl.
- **Análisis:** DataFrames.jl, JuMP, HiGHS y módulos estadísticos.
- **Base de datos:** PostgreSQL mediante Supabase.
- **Despliegue previsto:** Vercel para el frontend y Railway para la API Julia.

## Alcance principal

- Importación de datos desde CSV y una API de mercado.
- Indicadores de rendimiento, volatilidad, correlación y drawdown.
- Creación y optimización de carteras.
- Simulaciones Monte Carlo, VaR, CVaR y escenarios de estrés.
- Predicciones evaluables y backtesting.
- Visualización y persistencia de resultados.

## Estructura del repositorio

```text
.
├── README.md          # Introducción y guía general del proyecto
├── backend/           # Paquete Julia (dominio, importador CSV, pruebas y futura API)
├── database/          # Estructura para migraciones, semillas y documentación SQL
├── frontend/          # Estructura para la aplicación web Next.js + TypeScript
├── documentacion/     # Contexto, documentación técnica y datos
│   ├── contexto/      # Especificación de requisitos (SRS) y alcance
│   ├── tecnica/       # Arquitectura, métricas de dominio e importación CSV
│   └── datos/         # Datasets y documentación de datos
└── .gitignore         # Archivos excluidos del control de versiones
```

## Desarrollo local

El paquete base del backend en Julia ya puede ejecutarse y verificarse localmente desde la raíz del repositorio:

```bash
julia --project=backend -e 'using MarkovLabBackend'
julia --project=backend backend/test/runtests.jl
```

Los módulos de servidor HTTP, migraciones de base de datos y aplicación Next.js se encuentran pendientes de inicialización. Las credenciales y claves de API deberán configurarse mediante variables de entorno y nunca deben guardarse en el repositorio.

## Próximos pasos

1. Definir e implementar el esquema SQL y las migraciones en PostgreSQL (`database/`).
2. Exponer la API HTTP con `Oxygen.jl` y conectar la persistencia en `backend/`.
3. Ampliar los módulos de carteras, optimización (`JuMP`/`HiGHS`), simulación Monte Carlo, predicción y backtesting.
4. Inicializar y construir el frontend y sus visualizaciones en `frontend/`.
5. Integrar el proveedor de datos de mercado, datasets reproducibles y configuración de despliegue.

# MarkovLab

MarkovLab es un proyecto académico para el monitoreo, análisis y optimización de carteras financieras. El sistema busca combinar datos de mercado, análisis estadístico, predicciones, simulaciones Monte Carlo y optimización reproducible.

> El proyecto tiene fines educativos. No ejecuta operaciones financieras ni reemplaza asesoramiento profesional.

## Estado

En planificación y definición de la arquitectura. La especificación funcional completa está documentada en [`SRS.md`](./documentacion/contexto/SRS.md).

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

## Estructura inicial

```text
.
├── README.md          # Introducción y guía del proyecto
├── backend/           # Paquete Julia y futuras capas de API
├── documentacion/     # Contexto, documentación técnica y datos
│   ├── contexto/      # Requisitos y alcance
│   ├── tecnica/       # Arquitectura y decisiones técnicas
│   └── datos/         # Datasets y documentación de datos
└── .gitignore         # Archivos excluidos del control de versiones
```

Las áreas `frontend/` y `database/` se incorporan en sus ramas de trabajo respectivas y se integrarán posteriormente.

## Desarrollo local

La implementación todavía está en preparación. Antes de ejecutar el proyecto, se deberán configurar las herramientas de Julia y Node.js según los módulos que se incorporen.

Las credenciales y claves de API deberán configurarse mediante variables de entorno; nunca deben guardarse en el repositorio.

## Próximos pasos

1. Crear el esquema PostgreSQL.
2. Configurar el backend Julia y la importación de CSV.
3. Implementar los módulos de análisis financiero.
4. Construir el frontend y sus visualizaciones.
5. Agregar pruebas, datos reproducibles y documentación de despliegue.

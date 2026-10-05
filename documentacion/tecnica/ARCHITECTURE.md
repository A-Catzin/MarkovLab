# Arquitectura y responsabilidades de MarkovLab

Este documento es la referencia de la estructura del proyecto. `README.md` introduce el proyecto; `SRS.md` define los requisitos. La estructura aquí descrita distingue lo existente de lo previsto.

## Límites y flujo previsto

| Área | Responsabilidad | Límite |
|---|---|---|
| Frontend (previsto) | Interfaz Next.js/TypeScript y visualizaciones. | No consulta directamente PostgreSQL ni almacena secretos. |
| `backend/` (base actual) | Paquete Julia; a futuro, API HTTP, cálculos y coordinación de datos. | No contiene interfaz ni esquema SQL. |
| Base de datos (prevista) | PostgreSQL administrado por Supabase: datos y resultados persistentes. | El acceso de negocio pasa por el backend. |
| Documentación | `README.md` orienta, `SRS.md` especifica requisitos y este archivo fija límites y estructura; los README locales detallan cada directorio. | No sustituye código ni servicios desplegados. |

Flujo futuro: usuario → frontend → solicitud HTTP/JSON al backend → validación y servicios → dominio e infraestructura (PostgreSQL o proveedor de mercado) → respuesta JSON → visualización. Supabase no sustituye la API Julia; la integración externa y las credenciales pertenecen al backend. **Hoy no existe ese flujo en ejecución.**

## Ramas y estabilidad

`main` permanece estable: integrar allí únicamente cambios revisados y comprobados. `feature/backend` es dueña del trabajo de backend; `feature/frontend-dashboard`, del frontend; `feature/db-migrations`, del esquema y migraciones de base de datos; `docs/manual-csv-datasets`, de documentación y conjuntos CSV manuales. Cada rama aísla su ámbito antes de la integración; esta descripción no implica que sus componentes ya estén implementados.

## Árbol del backend (base actual)

```text
backend/
├── README.md                 # Inicio y límites del paquete
├── Project.toml              # Identidad y versión Julia, sin dependencias externas
├── src/
│   ├── README.md             # Mapa del código fuente
│   ├── MarkovLabBackend.jl    # Módulo mínimo
│   ├── api/README.md         # Contratos HTTP futuros
│   ├── domain/README.md      # Reglas y modelos puros futuros
│   ├── services/README.md    # Orquestación futura
│   └── infrastructure/README.md # Adaptadores externos futuros
├── test/
│   ├── README.md             # Estrategia de pruebas
│   └── runtests.jl           # Prueba mínima del paquete
├── config/README.md          # Configuración no sensible futura
└── scripts/README.md         # Automatización local futura
```

Los directorios `api`, `domain`, `services`, `infrastructure`, `config` y `scripts` contienen únicamente guías por ahora. No hay rutas HTTP, migraciones, integraciones, dependencias de producción, Docker, lógica financiera ni frontend ejecutable en esta base. Ver [`backend/README.md`](../../backend/README.md) para probar el paquete.

# Base de datos

Este directorio organiza el trabajo futuro de persistencia de MarkovLab. La arquitectura prevista utiliza PostgreSQL administrado por Supabase; la API Julia será responsable del acceso a los datos y de las reglas de negocio. El frontend no debe conectarse directamente a la base de datos ni a Supabase.

## Navegación

- [`migrations/`](./migrations/README.md): cambios versionados del esquema, cuando se definan.
- [`seeds/`](./seeds/README.md): datos de ejemplo reproducibles, cuando se definan.
- [`docs/`](./docs/README.md): decisiones y guías de la capa de datos.
- [`SRS.md`](../SRS.md): requisitos y arquitectura previstos para el proyecto.

## Estado y responsabilidad

La rama `feature/db-migrations` es el espacio de trabajo de este andamiaje documental de base de datos; no implica que existan migraciones implementadas. Este directorio delimita la organización de futuros cambios de persistencia, mientras que la lógica de negocio y el acceso operativo a PostgreSQL pertenecen al backend Julia.

Por ahora no hay esquema SQL, migraciones, datos semilla, configuración de Supabase, credenciales ni herramientas ejecutables de base de datos. Estos README no configuran ni despliegan una base de datos.

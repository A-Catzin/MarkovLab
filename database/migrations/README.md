# Migraciones

Este directorio reserva un lugar para cambios versionados del esquema PostgreSQL, cuando se acuerden el modelo de datos y el mecanismo de migración.

## Contenido previsto

Aquí podrán incorporarse migraciones revisables y su documentación de orden y aplicación. Cada cambio futuro deberá mantener trazable su efecto sobre el esquema.

## Límites

Hoy no hay migraciones, SQL ejecutable ni herramienta de aplicación configurada. Este espacio no implementa reglas de negocio ni acceso directo desde el frontend: las operaciones de la aplicación pasarán por la API Julia hacia PostgreSQL administrado por Supabase.

# Datos semilla

Este directorio reserva un lugar para datos de ejemplo reproducibles destinados a desarrollo o pruebas, alineados con el esquema PostgreSQL definido en [`../migrations/`](../migrations/README.md).

## Contenido previsto

Podrán incorporarse conjuntos de datos de muestra y notas que expliquen su origen, propósito y forma de uso, siempre sin información sensible.

## Límites

Hoy no hay archivos de datos semilla dedicados: las cargas iniciales y de respaldo se realizan mediante `backend/scripts/import_prices.jl` (CSV) y `backend/scripts/sync_prices.jl` (Apify). No se deben guardar credenciales, datos reales privados ni configuración de Supabase aquí. Las semillas no sustituyen las migraciones del esquema; el acceso de negocio a los datos corresponde a la API Julia, nunca directamente al frontend.

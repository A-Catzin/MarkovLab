# API

Responsabilidad: traducir solicitudes HTTP/JSON a operaciones del backend y devolver respuestas.

Contenido permitido: rutas, contratos de entrada/salida y validación de transporte. Límite: no calcular reglas financieras ni acceder directamente a PostgreSQL; esas tareas corresponden al dominio y a infraestructura.

## Contenido actual

- `Api.jl`: submódulo `MarkovLabBackend.Api` con una instancia propia de Oxygen (`@oxidize`) y `start()` para iniciar el servidor.
- `routes.jl`: `GET /health`, `POST /api/analysis/metrics` y `POST /api/risk/monte-carlo`.
- `errors.jl`: lectura y validación del JSON y conversión de excepciones en respuestas de error.
- `cors.jl`: CORS restringido a `ALLOWED_ORIGINS`.

Dentro de este módulo, `get` es el verbo de rutas de Oxygen; para diccionarios use `Base.get`.

Contrato completo en [`API.md`](../../../documentacion/tecnica/API.md).

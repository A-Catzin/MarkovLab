# Infraestructura

Responsabilidad: adaptar archivos, PostgreSQL y proveedores externos a las necesidades de los servicios.

Contenido permitido: conectores, repositorios y traducciones de datos externos. Límite: no exponer HTTP ni decidir reglas financieras; tampoco guardar credenciales en código.

## Contenido actual

- `csv_prices.jl`: importa precios históricos desde CSV y los traduce a `PriceBar` del dominio, informando filas inválidas y duplicadas. Ver [`IMPORTACION_CSV.md`](../../../documentacion/tecnica/IMPORTACION_CSV.md).

Aún no hay integraciones con PostgreSQL ni con la API de mercado.

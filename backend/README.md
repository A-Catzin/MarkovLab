# Backend Julia

Este directorio contiene la base comprobable del paquete `MarkovLabBackend`; aún no es un servidor. La organización y las conexiones previstas están en [`ARCHITECTURE.md`](../documentacion/tecnica/ARCHITECTURE.md).

## Inicio rápido

Desde la raíz del repositorio, con Julia instalado:

```bash
julia --project=backend -e 'using MarkovLabBackend'
julia --project=backend backend/test/runtests.jl
```

`Project.toml` define nombre, UUID, versión y dependencias (solo la biblioteca estándar `Dates` por ahora); `Manifest.toml` fija las versiones resueltas para que el entorno sea reproducible. `src/` contiene el módulo y sus capas; `test/` contiene las pruebas; `config/` y `scripts/` reservan límites para configuración y automatización. Consulte cada README local antes de incorporar archivos.

## Implementado

- Métricas financieras puras en `src/domain/`: rendimientos, volatilidad, drawdown y correlación. Ver [`METRICAS_DOMINIO.md`](../documentacion/tecnica/METRICAS_DOMINIO.md).
- Carteras: composición validada, covarianza, rendimiento y volatilidad. Ver [`CARTERAS_DOMINIO.md`](../documentacion/tecnica/CARTERAS_DOMINIO.md).
- Importación de precios históricos desde CSV con validación y detección de duplicados. Ver [`IMPORTACION_CSV.md`](../documentacion/tecnica/IMPORTACION_CSV.md).

El historial de cambios está en [`CHANGELOG.md`](CHANGELOG.md).

**Fuera de alcance actual:** servidor HTTP, base de datos, API de mercado, despliegue y secretos. No introduzca credenciales en el repositorio.

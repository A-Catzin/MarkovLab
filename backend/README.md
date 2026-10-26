# Backend Julia

Este directorio contiene el paquete `MarkovLabBackend`: cálculos financieros, importación de datos y una API HTTP mínima. La organización y las conexiones previstas están en [`ARCHITECTURE.md`](../documentacion/tecnica/ARCHITECTURE.md).

## Inicio rápido

Desde la raíz del repositorio, con Julia instalado:

```bash
julia --project=backend -e 'using Pkg; Pkg.instantiate()'   # primera vez
julia --project=backend backend/test/runtests.jl            # pruebas
julia --project=backend backend/scripts/serve.jl            # API en http://localhost:8080
```

`Project.toml` define nombre, UUID, versión y dependencias: `Oxygen` y `HTTP` para la API, y `Dates` y `Random` de la biblioteca estándar. `Manifest.toml` fija las versiones resueltas para que el entorno sea reproducible. `src/` contiene el módulo y sus capas; `test/` contiene las pruebas; `config/` documenta las variables de entorno y `scripts/` las tareas locales. Consulte cada README local antes de incorporar archivos.

## Implementado

- Métricas financieras puras en `src/domain/`: rendimientos, volatilidad, drawdown y correlación. Ver [`METRICAS_DOMINIO.md`](../documentacion/tecnica/METRICAS_DOMINIO.md).
- Carteras: composición validada, covarianza, rendimiento y volatilidad. Ver [`CARTERAS_DOMINIO.md`](../documentacion/tecnica/CARTERAS_DOMINIO.md).
- Simulación Monte Carlo de carteras, VaR y CVaR. Ver [`SIMULACION_RIESGO.md`](../documentacion/tecnica/SIMULACION_RIESGO.md).
- Importación de precios históricos desde CSV con validación y detección de duplicados. Ver [`IMPORTACION_CSV.md`](../documentacion/tecnica/IMPORTACION_CSV.md).
- API HTTP con Oxygen.jl: salud, métricas y Monte Carlo. Ver [`API.md`](../documentacion/tecnica/API.md).

El historial de cambios está en [`CHANGELOG.md`](CHANGELOG.md).

**Fuera de alcance actual:** base de datos, API de mercado, autenticación, despliegue y secretos. No introduzca credenciales en el repositorio.

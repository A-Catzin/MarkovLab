# Registro de cambios del backend

Historial de lo implementado en `MarkovLabBackend`. Las entradas más recientes van primero.

## [Sin publicar]

### Agregado — 2026-10-16: carteras en el dominio

- `src/domain/portfolio.jl`:
  - `Portfolio`: composición sin posiciones cortas que valida símbolos únicos, pesos entre 0 y 1 y suma de 100 % con tolerancia `PORTFOLIO_WEIGHT_TOLERANCE = 1e-6` (RF-28, RF-29).
  - `covariance_matrix`: covarianza muestral con anualización opcional.
  - `portfolio_returns`, `portfolio_return`, `portfolio_volatility`: serie histórica, rendimiento esperado y volatilidad `sqrt(wᵀΣw)` de la cartera (RF-30).
- `test/domain/portfolio_tests.jl`: reglas de validación, valores a mano y coherencia entre funciones.
- Documentación en [`CARTERAS_DOMINIO.md`](../documentacion/tecnica/CARTERAS_DOMINIO.md).

**Decisiones**

- Los pesos inválidos se rechazan en lugar de reescalarse, para que el usuario vea el error (RF-29).
- Las funciones de cartera aceptan vectores de pesos sin validar además de `Portfolio`, para que la optimización pueda evaluar candidatos.
- Nombre, capital, moneda y fecha (RF-27) quedan para la capa de persistencia.

**Siguientes pasos**

1. Monte Carlo, VaR y CVaR sobre `Portfolio` (RF-41 a RF-48).
2. API mínima con Oxygen.jl.

### Agregado — 2026-10-16: importación de precios desde CSV

- `src/domain/prices.jl`: `PriceBar`, observación OHLCV que valida símbolo, precios positivos, coherencia de máximo y mínimo y volumen no negativo.
- `src/infrastructure/csv_prices.jl`: `read_prices_csv` y `parse_prices_csv` importan `symbol,date,open,high,low,close,volume` (RF-02):
  - Filas inválidas se informan con línea y motivo sin detener la importación.
  - Duplicados por símbolo y fecha conservan la primera aparición y se informan (RF-05).
  - Encabezado sin distinción de mayúsculas, columnas en cualquier orden, mapeo de nombres del proveedor (`columns`) y símbolo fijo para archivos de un solo activo (`symbol`).
  - Resultado ordenado por símbolo y fecha.
- `test/domain/prices_tests.jl`, `test/infrastructure/csv_prices_tests.jl` y `test/fixtures/prices_sample.csv`.
- Documentación en [`IMPORTACION_CSV.md`](../documentacion/tecnica/IMPORTACION_CSV.md).

**Decisiones**

- Lector CSV propio en lugar de `CSV.jl`: el formato es fijo y simple; se evita una dependencia externa. Se puede reemplazar sin tocar el dominio.
- Primera dependencia: `Dates` (biblioteca estándar). Se agrega `Manifest.toml` al repositorio para fijar el entorno, ya que el backend es una aplicación desplegada.
- Importación parcial: un error en una fila no descarta el archivo completo; solo un encabezado inválido lo rechaza.

**Siguientes pasos**

1. API mínima con Oxygen.jl: `GET /health`, carga de CSV y endpoint de métricas.
2. Persistencia en PostgreSQL cuando se defina el esquema, con fuente y fecha de importación (RF-04).

### Agregado — 2026-10-16: métricas financieras del dominio

- `src/domain/errors.jl`: error `InsufficientDataError` para informar cuando un cálculo no tiene suficientes observaciones (RF-20).
- `src/domain/metrics.jl`: funciones puras de rendimiento, riesgo y correlación (RF-15, RF-16, RF-17):
  - `simple_returns`, `log_returns`
  - `cumulative_return`, `mean_return`, `volatility` (con anualización opcional)
  - `drawdowns`, `max_drawdown`
  - `correlation`, `correlation_matrix`
- `test/domain/metrics_tests.jl`: 42 pruebas con valores conocidos y casos de error.
- Documentación de fórmulas y supuestos en [`METRICAS_DOMINIO.md`](../documentacion/tecnica/METRICAS_DOMINIO.md).

**Decisiones**

- Sin dependencias externas: media y desviación estándar se implementan en el dominio para mantener el paquete liviano y reproducible. Se podrá migrar a `Statistics` si se incorporan más cálculos estadísticos.
- La capa de dominio no conoce HTTP, base de datos ni proveedores, según [`ARCHITECTURE.md`](../documentacion/tecnica/ARCHITECTURE.md).

**Siguientes pasos**

1. Importación y validación de CSV `symbol,date,open,high,low,close,volume` sin duplicados por activo y fecha (RF-02, RF-05).
2. API mínima con Oxygen.jl: `GET /health` y un endpoint de métricas.
3. Persistencia en PostgreSQL cuando se defina el esquema.

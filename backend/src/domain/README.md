# Dominio

Responsabilidad: definir modelos y reglas financieras independientes de servicios externos.

Contenido permitido: tipos, invariantes y cálculos puros con pruebas reproducibles. Límite: no recibir HTTP, consultar proveedores ni persistir datos; esas operaciones pertenecen a otras capas.

## Contenido actual

- `errors.jl`: `InsufficientDataError`, lanzado cuando un cálculo recibe menos observaciones de las necesarias.
- `metrics.jl`: rendimientos simples y logarítmicos, rendimiento acumulado, media, volatilidad, drawdown y correlación.
- `prices.jl`: `PriceBar`, observación OHLCV que valida sus invariantes al construirse.
- `portfolio.jl`: `Portfolio` (composición validada), covarianza y rendimiento y volatilidad de cartera. Ver [`CARTERAS_DOMINIO.md`](../../../documentacion/tecnica/CARTERAS_DOMINIO.md).

Fórmulas, supuestos y ejemplos en [`METRICAS_DOMINIO.md`](../../../documentacion/tecnica/METRICAS_DOMINIO.md); reglas de `PriceBar` en [`IMPORTACION_CSV.md`](../../../documentacion/tecnica/IMPORTACION_CSV.md).

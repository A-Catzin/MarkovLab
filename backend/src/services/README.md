# Servicios

Responsabilidad: coordinar casos de uso entre dominio e infraestructura.

Contenido permitido: orquestación y validaciones de aplicación independientes del transporte. Límite: no definir rutas HTTP, implementar conectores externos ni duplicar cálculos del dominio.

## Contenido actual

- `analysis.jl`: `analyze_prices`, resumen de métricas de una serie de precios.
- `risk.jl`: `run_monte_carlo`, que estima rendimientos y covarianza a partir de precios, simula la cartera, resume los resultados y devuelve los parámetros para reproducirla. Define los límites `MAX_SIMULATIONS` y `MAX_HORIZON` y el identificador de modelo `MONTE_CARLO_MODEL`.

Los contratos HTTP que usan estos servicios están en [`API.md`](../../../documentacion/tecnica/API.md).

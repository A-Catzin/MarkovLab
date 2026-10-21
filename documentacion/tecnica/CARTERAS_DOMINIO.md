# Carteras en el dominio

Referencia de `backend/src/domain/portfolio.jl`: composición de una cartera y su rendimiento y riesgo. Cubre RF-28, RF-29, RF-30 y RF-31 del [SRS](../contexto/SRS.md) y es la base de la optimización, las simulaciones Monte Carlo y el backtesting.

## Convenciones

- Las matrices de rendimientos tienen **una fila por fecha y una columna por activo**, alineadas por fecha.
- El orden de las columnas debe coincidir con el orden de `symbols` y `weights` de la cartera.
- Los pesos se expresan como fracciones: `0.6` equivale a 60 %.
- El período del resultado es el de los datos de entrada: con rendimientos diarios se obtienen valores diarios, salvo que se anualice.

## Uso rápido

```julia
using MarkovLabBackend

portfolio = Portfolio(["AAPL" => 0.6, "MSFT" => 0.4])

# filas = fechas, columnas = AAPL, MSFT
returns = [0.01  0.02;
           0.03 -0.01;
          -0.02  0.04]

means = [mean_return(returns[:, j]) for j in 1:2]
cov = covariance_matrix(returns)

portfolio_return(portfolio, means)       # rendimiento esperado por período
portfolio_volatility(portfolio, cov)     # volatilidad esperada por período

series = portfolio_returns(portfolio, returns)
max_drawdown([1.0; cumprod(1 .+ series)]) # drawdown de la cartera (índice que parte de 1)
```

## `Portfolio`

```julia
Portfolio(symbols, weights)
Portfolio(["AAPL" => 0.6, "MSFT" => 0.4])
```

Composición de una cartera sin posiciones cortas. Al construirse valida (RF-29):

| Regla | Ejemplo rechazado |
|---|---|
| Al menos un activo (SRS 7.2). | `Portfolio(String[], Float64[])` |
| Igual cantidad de símbolos y pesos. | 2 símbolos, 1 peso |
| Símbolos no vacíos y únicos; se normalizan a mayúsculas. | `["A", "a"]` |
| Cada peso finito y entre 0 y 1. | `[1.2, -0.2]` |
| Los pesos suman 1 (100 %) con tolerancia `PORTFOLIO_WEIGHT_TOLERANCE = 1e-6`. | `[0.5, 0.4]` |

Los errores se lanzan como `ArgumentError` con un mensaje que indica el valor inválido. Los pesos no se reescalan: si no suman 100 %, la cartera se rechaza.

La tolerancia absorbe errores de redondeo, como tres pesos de `1/3`. Equivale a 0,0001 %.

Nombre, capital inicial, moneda y fecha (RF-27) son datos de persistencia y se agregarán con la base de datos; `Portfolio` solo modela la composición. La composición porcentual (RF-31) se obtiene directamente de `symbols` y `weights`.

## Funciones

| Función | Resultado | Requisito |
|---|---|---|
| `covariance_matrix(returns; periods_per_year)` | Matriz de covarianzas `k × k` | RF-30 |
| `portfolio_returns(weights_o_cartera, returns)` | Serie histórica de rendimientos de la cartera | RF-30 |
| `portfolio_return(weights_o_cartera, expected_returns)` | Rendimiento esperado | RF-30 |
| `portfolio_volatility(weights_o_cartera, covariance)` | Volatilidad esperada | RF-30 |

Todas aceptan un vector de pesos o un `Portfolio`. Los pesos sueltos no se validan, para que la optimización pueda evaluar candidatos; se valida que la cantidad coincida con la de activos.

### `covariance_matrix(returns; periods_per_year=nothing)`

```text
Σ_ij = Σ_t (r_i,t - media_i)(r_j,t - media_j) / (n - 1)
Σ_anual = Σ * periods_per_year
```

Covarianza muestral. Requiere al menos 2 observaciones y valores finitos. La diagonal es la varianza de cada activo: `Σ_ii = volatility(r_i)²`.

### `portfolio_returns(weights, returns)`

```text
r_p,t = Σ_i w_i · r_i,t
```

Rendimiento de la cartera en cada fecha, suponiendo **rebalanceo en cada período** a los pesos objetivo. La serie puede pasarse a `volatility`, `cumulative_return` o `mean_return`.

### `portfolio_return(weights, expected_returns)`

```text
μ_p = Σ_i w_i · μ_i
```

`expected_returns` suele ser la media histórica de cada activo (`mean_return` por columna). Coincide con la media de `portfolio_returns`.

### `portfolio_volatility(weights, covariance)`

```text
σ_p = sqrt(wᵀ Σ w) = sqrt( Σ_i Σ_j w_i · w_j · Σ_ij )
```

Exige una matriz cuadrada y simétrica del mismo tamaño que los pesos. Coincide con `volatility(portfolio_returns(...))` sobre los mismos datos. Captura la diversificación: activos con correlación negativa reducen el riesgo total. Si el redondeo produce una varianza levemente negativa, se devuelve `0.0`.

## Supuestos y límites

- Solo posiciones largas (pesos entre 0 y 1), como establece el SRS salvo que un modelo permita cortos.
- Rebalanceo en cada período en `portfolio_returns`; una cartera de compra y mantenimiento requerirá otra función en backtesting.
- La alineación de fechas entre activos es responsabilidad del llamador (futura capa de servicios).
- El rendimiento esperado basado en medias históricas no es una predicción garantizada (RF-25).

## Pruebas

`backend/test/domain/portfolio_tests.jl` verifica cada regla de validación, valores calculados a mano y coherencias entre funciones: la diagonal de la covarianza con `volatility`, `portfolio_return` con la media de la serie y `portfolio_volatility` con la volatilidad de la serie.

```bash
julia --project=backend backend/test/runtests.jl
```

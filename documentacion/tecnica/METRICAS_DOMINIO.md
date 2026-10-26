# Métricas financieras del dominio

Referencia de las funciones puras de `backend/src/domain/` que calculan rendimientos, riesgo y correlación. Cubren los requisitos RF-15, RF-16, RF-17 y RF-20 del [SRS](../contexto/SRS.md) y documentan fórmulas y supuestos según RNF-18.

## Convenciones

- Las series se ordenan de la observación más antigua a la más reciente.
- Los rendimientos se expresan como fracciones: `0.05` equivale a 5 %.
- Los precios deben ser números finitos y positivos; en caso contrario se lanza `ArgumentError`.
- Los rendimientos y valores deben ser finitos (sin `NaN` ni `Inf`).
- Cuando faltan observaciones se lanza `InsufficientDataError` (RF-20).
- Las funciones no acceden a red, base de datos ni estado global: con la misma entrada producen el mismo resultado (RNF-16).

## Uso rápido

```julia
using MarkovLabBackend

prices = [100.0, 110.0, 99.0, 108.9]

r = simple_returns(prices)          # [0.10, -0.10, 0.10]
cumulative_return(r)                # 0.089
volatility(r; periods_per_year=252) # volatilidad anualizada
max_drawdown(prices)                # -0.10
```

## Funciones

| Función | Entrada | Mínimo | Resultado | Requisito |
|---|---|---|---|---|
| `simple_returns(prices)` | Precios | 2 precios | Vector de `n - 1` rendimientos | RF-15 |
| `log_returns(prices)` | Precios | 2 precios | Vector de `n - 1` rendimientos | RF-15 |
| `cumulative_return(returns)` | Rendimientos simples | 1 | Escalar | RF-16 |
| `mean_return(returns)` | Rendimientos | 1 | Escalar | RF-16 |
| `volatility(returns; periods_per_year)` | Rendimientos | 2 | Escalar | RF-16 |
| `drawdowns(prices)` | Precios | 1 | Vector de `n` valores ≤ 0 | RF-16 |
| `max_drawdown(prices)` | Precios | 2 | Escalar ≤ 0 | RF-16 |
| `correlation(a, b)` | Dos series de igual longitud | 2 | Escalar en `[-1, 1]` | RF-17 |
| `correlation_matrix(returns)` | Matriz observaciones × activos | 2 filas, 2 columnas | Matriz simétrica | RF-17, RF-18 |

### `simple_returns(prices)`

```text
r_t = P_t / P_{t-1} - 1
```

Rendimiento porcentual entre períodos consecutivos. Es el que se agrega correctamente entre activos de una cartera.

### `log_returns(prices)`

```text
r_t = ln(P_t / P_{t-1})
```

Los rendimientos logarítmicos se suman en el tiempo: `sum(log_returns(p)) == ln(P_n / P_1)`. Son útiles para modelos estadísticos y simulaciones.

### `cumulative_return(returns)`

```text
R = (1 + r_1)(1 + r_2)...(1 + r_n) - 1
```

Recibe rendimientos **simples**. Para precios `P`, `cumulative_return(simple_returns(P)) == P_n / P_1 - 1`.

### `mean_return(returns)`

```text
media = (r_1 + ... + r_n) / n
```

Media aritmética del período, sin anualizar.

### `volatility(returns; periods_per_year=nothing)`

```text
σ = sqrt( Σ (r_t - media)² / (n - 1) )
σ_anual = σ * sqrt(periods_per_year)
```

Desviación estándar muestral. Si se indica `periods_per_year` (252 para datos diarios, 52 semanales, 12 mensuales) se anualiza; debe ser positivo. Una serie constante devuelve `0.0`.

### `drawdowns(prices)` y `max_drawdown(prices)`

```text
D_t = P_t / max(P_1, ..., P_t) - 1
MDD = min(D_t)
```

`drawdowns` devuelve la caída respecto del máximo previo en cada punto: `0.0` en un nuevo máximo y negativo por debajo. `max_drawdown` devuelve la peor caída como valor no positivo; `-0.25` significa una caída de 25 % desde un máximo previo.

### `correlation(a, b)`

```text
ρ = Σ (a_t - ā)(b_t - b̄) / sqrt( Σ (a_t - ā)² · Σ (b_t - b̄)² )
```

Correlación de Pearson. Lanza `ArgumentError` si las series tienen distinta longitud o si alguna tiene varianza cero, porque la correlación no está definida. El resultado se acota a `[-1, 1]` para absorber errores de redondeo.

### `correlation_matrix(returns)`

Recibe una matriz donde cada fila es una fecha y cada columna un activo. Devuelve la matriz `k × k` de correlaciones de Pearson, simétrica y con unos en la diagonal. Requiere al menos 2 activos y 2 observaciones; los rendimientos deben estar alineados por fecha antes de llamarla.

## Errores

| Error | Cuándo | Campos |
|---|---|---|
| `InsufficientDataError` | Hay menos observaciones que el mínimo de la función (RF-20). | `required`, `available`, `context` |
| `ArgumentError` | Precio no positivo o no finito, valor no finito, longitudes distintas, varianza cero, `periods_per_year ≤ 0` o menos de 2 activos. | Mensaje descriptivo |

La futura capa `api/` deberá traducir `InsufficientDataError` en una respuesta que indique al usuario que el período no tiene datos suficientes.

## Supuestos y límites

- No se alinean fechas ni se rellenan valores faltantes; esa preparación corresponde a la ingesta o a los servicios.
- No hay tasa libre de riesgo ni ratio de Sharpe todavía; se incorporarán con optimización y backtesting.
- La volatilidad anualizada asume rendimientos independientes entre períodos (regla de la raíz del tiempo).

## Pruebas

Las pruebas están en `backend/test/domain/metrics_tests.jl` y verifican valores conocidos, invariantes (por ejemplo, la suma de rendimientos logarítmicos) y cada caso de error. Ejecución desde la raíz:

```bash
julia --project=backend backend/test/runtests.jl
```

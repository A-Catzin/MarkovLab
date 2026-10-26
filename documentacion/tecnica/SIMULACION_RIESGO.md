# Simulación Monte Carlo y medidas de riesgo

Referencia de `backend/src/domain/simulation.jl`: simulación de resultados de una cartera, VaR, CVaR y resumen de la distribución. Cubre RF-41 a RF-44 y RF-48 del [SRS](../contexto/SRS.md), además de RNF-03 (10.000 escenarios) y RNF-16 (reproducibilidad con semilla). Se apoya en las funciones de [carteras](CARTERAS_DOMINIO.md).

## Convenciones

- Un **resultado** (*outcome*) es el rendimiento total de la cartera en todo el horizonte, como fracción: `-0.08` es una pérdida de 8 %.
- VaR y CVaR se expresan como **pérdidas positivas**: `value_at_risk = 0.08` significa "se pierde como máximo 8 % con la confianza indicada".
- Rendimientos esperados, covarianza y horizonte deben estar en el **mismo período**: datos diarios con horizonte en días hábiles, o datos mensuales con horizonte en meses.

## Uso rápido

```julia
using MarkovLabBackend

portfolio = Portfolio(["AAPL" => 0.6, "MSFT" => 0.4])
means = [mean_return(returns[:, j]) for j in 1:2]   # returns: fechas × activos, diarios
cov = covariance_matrix(returns)

outcomes = simulate_portfolio_returns(portfolio, means, cov;
                                      simulations=10_000, horizon=21, seed=42)

summary = summarize_outcomes(outcomes; confidence=0.95)
summary.value_at_risk               # pérdida máxima con 95 % de confianza a 21 días
summary.conditional_value_at_risk   # pérdida promedio en el 5 % peor
summary.percentiles[50]             # mediana
capital = 10_000
capital * summary.value_at_risk     # VaR en unidades monetarias
```

## Funciones

| Función | Resultado | Requisito |
|---|---|---|
| `simulate_portfolio_returns(cartera_o_pesos, expected_returns, covariance; simulations, horizon, seed)` | Vector con un resultado por escenario | RF-41, RF-42, RF-43 |
| `value_at_risk(outcomes; confidence=0.95)` | VaR | RF-44 |
| `conditional_value_at_risk(outcomes; confidence=0.95)` | CVaR | RF-44 |
| `summarize_outcomes(outcomes; confidence=0.95)` | Resumen de la distribución | RF-48 |
| `empirical_quantile(values, p)` | Cuantil empírico | Auxiliar |

VaR, CVaR y el resumen sirven tanto para resultados simulados como para rendimientos históricos, por ejemplo los de `portfolio_returns`.

### `simulate_portfolio_returns`

**Modelo.** Los rendimientos de los activos en cada período siguen una normal multivariada con media `μ` y covarianza `Σ`. Como la cartera se rebalancea en cada período, su rendimiento por período es una combinación lineal de normales y, por lo tanto, también es normal:

```text
r_p,t ~ N(μ_p, σ_p²)      μ_p = wᵀμ      σ_p = sqrt(wᵀΣw)
resultado = (1 + r_p,1)(1 + r_p,2)...(1 + r_p,h) - 1
```

Por eso basta con simular una variable por período en lugar de una por activo: es exacto bajo el modelo y no requiere descomponer `Σ`. `μ_p` y `σ_p` se calculan con `portfolio_return` y `portfolio_volatility`, que validan tamaños y simetría.

**Parámetros.**

| Parámetro | Valor por defecto | Regla |
|---|---|---|
| `simulations` | `10_000` | Entero ≥ 1 (RF-41). |
| `horizon` | `1` | Períodos ≥ 1 (RF-42). |
| `seed` | `nothing` | Entero para resultados reproducibles; `nothing` usa una semilla aleatoria (RNF-16). |

El generador es `Random.Xoshiro`. Con la misma semilla y la misma versión de Julia los resultados son idénticos; entre versiones de Julia la secuencia podría cambiar, por lo que al persistir una simulación (RF-47) se debe guardar también la versión.

### `empirical_quantile(values, p)`

Cuantil con interpolación lineal entre valores ordenados (tipo 7 de Hyndman y Fan, el predeterminado de R, NumPy y `Statistics.jl`):

```text
h = (n - 1) · p + 1
q = x_⌊h⌋ + (h - ⌊h⌋) · (x_⌊h⌋+1 - x_⌊h⌋)
```

### `value_at_risk(outcomes; confidence=0.95)`

```text
VaR_α = -q_(1-α)(outcomes)
```

Con `confidence = 0.95` se toma el percentil 5 de los resultados y se cambia el signo. Un VaR negativo indica que incluso ese percentil es una ganancia.

### `conditional_value_at_risk(outcomes; confidence=0.95)`

```text
CVaR_α = -media{ o ∈ outcomes : o ≤ q_(1-α) }
```

Pérdida promedio en la cola: siempre es mayor o igual que el VaR, porque promedia los resultados iguales o peores que el umbral.

### `summarize_outcomes(outcomes; confidence=0.95)`

Devuelve un `NamedTuple` con:

| Campo | Contenido |
|---|---|
| `scenarios` | Cantidad de resultados. |
| `mean` | Resultado promedio. |
| `worst`, `best` | Peor y mejor resultado (RF-48). |
| `percentiles` | `Dict` con los percentiles 1, 5, 25, 50, 75, 95 y 99. |
| `confidence` | Nivel de confianza usado. |
| `value_at_risk`, `conditional_value_at_risk` | VaR y CVaR con esa confianza. |

`confidence` debe estar estrictamente entre 0 y 1; si no, se lanza `ArgumentError`.

## Supuestos y límites

- La normalidad subestima eventos extremos (colas pesadas); los escenarios de estrés (RF-46) servirán para complementar.
- Rendimientos independientes entre períodos y parámetros constantes durante el horizonte.
- Con volatilidades muy altas, un rendimiento normal puede ser menor que -100 %; con datos diarios o mensuales realistas es despreciable.
- No se guardan parámetros ni resultados (RF-47) ni se informa el progreso (RNF-02); corresponde a las capas de servicios y persistencia.

## Pruebas

`backend/test/domain/simulation_tests.jl` verifica cuantiles, VaR y CVaR con valores calculados a mano, el resumen, la reproducibilidad por semilla, que un período simulado tenga media y volatilidad `μ_p` y `σ_p`, la capitalización del horizonte, 10.000 escenarios a 252 períodos y cada parámetro inválido.

```bash
julia --project=backend backend/test/runtests.jl
```

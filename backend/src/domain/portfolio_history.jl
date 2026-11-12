# Historia del valor de una cartera: cuánto habría valido día por día si se compraran sus
# activos con sus pesos y se mantuvieran (comprar y mantener, sin rebalanceo).

"""
    portfolio_value_history(prices, weights, capital, anchor::Date) -> (; dates, values, anchor)

Valor diario de una cartera de comprar y mantener. `prices[i]` es la serie `(fecha, precio)`
del activo `i`, de la más vieja a la más nueva; `weights[i]` su peso.

- **Ancla:** el día `anchor` (cuando el usuario creó la cartera) la cartera vale `capital`,
  repartido según los pesos. Las unidades de cada activo salen de ese día, así que antes
  del ancla la curva muestra cuánto habría valido y después, cuánto vale. Si no hay precio
  ese día se usa el último día anterior con precio; si la cartera es anterior a todos los
  precios, el primero.
- **Ventana:** empieza el primer día en que todos los activos tienen precio. Los días en
  que un activo no cotizó (otro mercado, feriado) se usa su último precio.

Lanza `InsufficientDataError` si algún activo no tiene precios o si la ventana común tiene
menos de dos días, y `ArgumentError` si las series y los pesos no coinciden.
"""
function portfolio_value_history(prices::AbstractVector, weights::AbstractVector{<:Real}, capital::Real,
                                 anchor::Date)
    length(prices) == length(weights) ||
        throw(ArgumentError("there are $(length(prices)) price series but $(length(weights)) weights"))
    any(isempty, prices) && throw(InsufficientDataError(1, 0, "price history of every asset"))
    start = maximum(first(series)[1] for series in prices)
    dates = sort!(unique!([date for series in prices for (date, _) in series if date >= start]))
    length(dates) < 2 && throw(InsufficientDataError(2, length(dates), "days with prices for every asset"))

    # Precio de cada activo en cada día de la ventana, arrastrando el último conocido.
    filled = map(prices) do series
        lookup = Dict(series)
        last_price = last(p for (d, p) in series if d <= start)
        [(last_price = get(lookup, date, last_price)) for date in dates]
    end
    anchor_index = something(findlast(<=(anchor), dates), 1)
    units = [capital * w / column[anchor_index] for (w, column) in zip(weights, filled)]
    values = [sum(units[i] * filled[i][t] for i in eachindex(units)) for t in eachindex(dates)]
    return (; dates, values, anchor=dates[anchor_index])
end

"""
    aligned_prices(prices; from::Date, min_days) -> (; dates, prices)

Precios de varios activos alineados por fecha, para estimar rendimientos y covarianzas: solo
los días desde `from` en que **todos** los activos tienen precio. A diferencia de
[`portfolio_value_history`](@ref), no arrastra el último precio: un día inventado sería un
rendimiento de cero que bajaría la volatilidad. `prices[i]` es la serie `(fecha, precio)`
del activo `i`, de la más vieja a la más nueva.

Lanza `InsufficientDataError` si quedan menos de `min_days` días.
"""
function aligned_prices(prices::AbstractVector; from::Date, min_days::Integer)
    lookups = [Dict(series) for series in prices]
    common = isempty(lookups) ? Date[] : reduce(intersect, [Set(keys(l)) for l in lookups])
    dates = sort!([date for date in common if date >= from])
    length(dates) < min_days && throw(InsufficientDataError(min_days, length(dates), "days with prices for every asset"))
    return (; dates, prices=[[lookup[date] for date in dates] for lookup in lookups])
end

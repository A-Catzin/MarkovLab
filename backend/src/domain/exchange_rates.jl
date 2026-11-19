# Tipos de cambio diarios y conversión de series de precios a otra moneda. El dólar es la
# moneda puente: un tipo de cambio dice cuántas unidades de una moneda vale 1 USD ese día,
# y con dos de ellos sale cualquier combinación.

"""
Símbolo de Yahoo Finance del tipo de cambio de cada moneda contra el dólar: `MXN=X` es
"USD/MXN" (pesos por 1 USD) y `EUR=X` es "USD/EUR" (euros por 1 USD). Son las monedas
que ofrece el formulario de carteras, además del dólar.
"""
const EXCHANGE_RATE_SYMBOLS = Dict("MXN" => "MXN=X", "EUR" => "EUR=X")

"""
Cuántos días hábiles puede tener un tipo de cambio para usarse en un día sin el suyo (un
feriado del mercado de divisas, o del de la moneda). Más viejo que eso, el día se descarta.
"""
const MAX_RATE_GAP_DAYS = 5

"""
    MissingExchangeRateError(from, to)

No hay tipos de cambio para convertir de `from` a `to`: falta la serie de alguna de las
dos monedas contra el dólar.
"""
struct MissingExchangeRateError <: Exception
    from::String
    to::String
end

Base.showerror(io::IO, err::MissingExchangeRateError) =
    print(io, "there are no exchange rates to convert $(err.from) to $(err.to)")

"""
Puerto de tipos de cambio, que implementa cada adaptador de [`PriceRepository`](@ref):

    save_exchange_rates(repository, currency, rates; source=:api) -> inserted

guarda los tipos de cambio `(fecha, valor)` de `currency` (unidades por 1 USD) que todavía
no existen para esa moneda, fecha y origen, y devuelve cuántos guardó. Lanza
`ArgumentError` si la moneda no es un código de tres letras distinto de `USD`, si algún
valor no es positivo y finito o si el origen no es uno de [`PRICE_SOURCES`](@ref).

    exchange_rates(repository, currency) -> Vector{Tuple{Date,Float64}}

devuelve un valor por día, del más viejo al más nuevo; si el mismo día tiene valor de la
API y del CSV, el de la API.

    latest_exchange_rate_date(repository, currency; source=:api) -> Union{Nothing,Date}

devuelve la fecha del último tipo de cambio guardado con ese origen.
"""
function save_exchange_rates end
function exchange_rates end
function latest_exchange_rate_date end

"""
    check_exchange_rates(currency, rates, source) -> String

Valida lo que se va a guardar con las mismas reglas que la tabla `tipos_cambio` y devuelve
la moneda en mayúsculas.
"""
function check_exchange_rates(currency::AbstractString, rates, source::Symbol)
    code = uppercase(strip(currency))
    occursin(CURRENCY_PATTERN, code) && code != "USD" ||
        throw(ArgumentError("exchange rates are stored per three-letter currency other than USD, got $currency"))
    source in PRICE_SOURCES || throw(ArgumentError("unknown price source $source"))
    for (date, value) in rates
        isfinite(value) && value > 0 || throw(ArgumentError("the exchange rate of $code on $date must be positive, got $value"))
    end
    return code
end

"""
    convert_series(series, from, to, rates; max_gap=MAX_RATE_GAP_DAYS) -> Vector{Tuple{Date,Float64}}

Convierte la serie de precios `(fecha, precio)` de la moneda `from` a la moneda `to` con el
tipo de cambio de cada día. `rates[moneda]` es la serie `(fecha, unidades por 1 USD)` de
cada moneda distinta del dólar, de la más vieja a la más nueva.

- Si `from == to`, la serie no cambia (y no hace falta ningún tipo de cambio).
- Precio en `to` = precio en `from` × (`to` por USD) ÷ (`from` por USD).
- Un día sin tipo de cambio usa el último anterior, si tiene a lo más `max_gap` días
  hábiles; si no, o si es anterior al primer tipo de cambio, el día se descarta.

Lanza [`MissingExchangeRateError`](@ref) si falta la serie de `from` o de `to`.
"""
function convert_series(series::AbstractVector, from::AbstractString, to::AbstractString,
                        rates::AbstractDict; max_gap::Integer=MAX_RATE_GAP_DAYS)
    from == to && return collect(Tuple{Date,Float64}, series)
    rate_from = usd_rate_lookup(rates, from, from, to, max_gap)
    rate_to = usd_rate_lookup(rates, to, from, to, max_gap)
    converted = Tuple{Date,Float64}[]
    for (date, price) in series
        a, b = rate_from(date), rate_to(date)
        (a === nothing || b === nothing) && continue
        push!(converted, (date, price * b / a))
    end
    return converted
end

# Devuelve una función fecha -> unidades de `currency` por 1 USD (o `nothing` si no hay un
# valor suficientemente reciente). El dólar vale 1 siempre.
function usd_rate_lookup(rates::AbstractDict, currency::AbstractString, from, to, max_gap::Integer)
    currency == "USD" && return _ -> 1.0
    known = get(rates, currency, nothing)
    (known === nothing || isempty(known)) && throw(MissingExchangeRateError(from, to))
    dates = first.(known)
    return function (date::Date)
        i = searchsortedlast(dates, date)
        i == 0 && return nothing
        business_days_between(dates[i], date) <= max_gap || return nothing
        return Float64(known[i][2])
    end
end

# Días hábiles (lunes a viernes) después de `a` y hasta `b`, inclusive.
business_days_between(a::Date, b::Date) = count(d -> dayofweek(d) <= 5, a + Day(1):Day(1):b)

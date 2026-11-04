"""
    PriceBar(symbol, date, open, high, low, close, volume, adj_close=nothing)

Una observación histórica OHLCV de un activo. El constructor normaliza el
símbolo (sin espacios, en mayúsculas) y exige los invariantes:

- `symbol` no está vacío;
- `open`, `high`, `low` y `close` son finitos y positivos;
- `high` es el mayor y `low` el menor de los cuatro precios;
- `volume` es finito y no negativo;
- `adj_close` (cierre ajustado por dividendos y splits, el `Adj Close` de los CSV) es
  opcional; si se da, es finito y positivo. No se compara con el rango del día, porque
  descuenta eventos posteriores y puede quedar por debajo del mínimo.

Las violaciones lanzan `ArgumentError`.
"""
struct PriceBar
    symbol::String
    date::Date
    open::Float64
    high::Float64
    low::Float64
    close::Float64
    volume::Float64
    adj_close::Union{Nothing,Float64}

    function PriceBar(symbol::AbstractString, date::Date, open::Real, high::Real,
                      low::Real, close::Real, volume::Real, adj_close::Union{Nothing,Real}=nothing)
        normalized = uppercase(strip(symbol))
        isempty(normalized) && throw(ArgumentError("symbol must not be empty"))
        for (name, price) in (("open", open), ("high", high), ("low", low), ("close", close))
            (isfinite(price) && price > 0) ||
                throw(ArgumentError("$name must be a finite positive number, got $price"))
        end
        high >= max(open, low, close) ||
            throw(ArgumentError("high ($high) must be greater than or equal to open, low and close"))
        low <= min(open, close) ||
            throw(ArgumentError("low ($low) must be less than or equal to open and close"))
        (isfinite(volume) && volume >= 0) ||
            throw(ArgumentError("volume must be a finite non-negative number, got $volume"))
        adj_close === nothing || (isfinite(adj_close) && adj_close > 0) ||
            throw(ArgumentError("adj close must be a finite positive number, got $adj_close"))
        return new(String(normalized), date, open, high, low, close, volume,
                   adj_close === nothing ? nothing : Float64(adj_close))
    end
end

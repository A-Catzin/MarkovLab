"""
    PriceBar(symbol, date, open, high, low, close, volume)

One historical OHLCV observation of an asset. The constructor normalizes the
symbol (trimmed, uppercase) and enforces the invariants:

- `symbol` is not empty;
- `open`, `high`, `low` and `close` are finite and positive;
- `high` is the highest and `low` the lowest of the four prices;
- `volume` is finite and non-negative.

Violations throw `ArgumentError`.
"""
struct PriceBar
    symbol::String
    date::Date
    open::Float64
    high::Float64
    low::Float64
    close::Float64
    volume::Float64

    function PriceBar(symbol::AbstractString, date::Date, open::Real, high::Real,
                      low::Real, close::Real, volume::Real)
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
        return new(String(normalized), date, open, high, low, close, volume)
    end
end

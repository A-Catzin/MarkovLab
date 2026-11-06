# Precios desde una fuente de mercado (una API) en vez de un CSV. La fuente entrega, por
# símbolo, los datos del activo y sus precios diarios ya validados como `PriceBar`.

"""
    MarketSeries(symbol, details, bars, invalid, error, corrected=ImportIssue[])

Lo que una [`MarketDataSource`](@ref) devolvió para un símbolo: los datos del activo
(`nothing` si no se pudieron leer), los precios válidos, las filas que no pasaron la
validación (`ImportIssue`, con `line` contado desde 1 dentro de la serie), si la fuente
no pudo entregar nada útil el motivo en `error`, y las filas que se guardaron corregidas
(`corrected`, también incluidas en `bars`).
"""
struct MarketSeries
    symbol::String
    details::Union{Nothing,AssetDetails}
    bars::Vector{PriceBar}
    invalid::Vector{ImportIssue}
    error::Union{Nothing,String}
    corrected::Vector{ImportIssue}
end

MarketSeries(symbol, details, bars, invalid, error) = MarketSeries(symbol, details, bars, invalid, error, ImportIssue[])

"""
Puerto de una fuente de precios de mercado. Cada adaptador implementa

    fetch_daily_prices(source, symbols, from::Date, to::Date) -> Vector{MarketSeries}

con los precios diarios de `from` a `to` (ambos incluidos) de cada símbolo. Un símbolo que
la fuente no conoce puede faltar en la respuesta. Nunca devuelve el precio del día en curso
del mercado, que todavía puede cambiar.
"""
abstract type MarketDataSource end

"""
    MarketDataError(message)

La fuente de mercado no respondió o respondió algo inutilizable (caída, tiempo agotado,
HTTP de error). El mensaje nunca incluye credenciales.
"""
struct MarketDataError <: Exception
    message::String
end

Base.showerror(io::IO, err::MarketDataError) = print(io, "MarketDataError: ", err.message)

function fetch_daily_prices end

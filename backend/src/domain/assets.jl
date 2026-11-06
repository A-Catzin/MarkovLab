# Activos y su catálogo de precios. El CSV de precios no trae los datos descriptivos del
# activo (nombre, mercado, categoría, moneda), así que se reciben aparte.

const CURRENCY_PATTERN = r"^[A-Z]{3}$"

"""
    AssetDetails(name, market, category, currency)

Datos descriptivos de un activo (RF-01) que acompañan a una importación de precios.
El constructor recorta espacios y pasa el mercado y la moneda a mayúsculas, para que
`NASDAQ` y `nasdaq` sean el mismo mercado. Lanza `ArgumentError`
si algún campo está vacío o trae caracteres de control, o si la moneda no es un código
ISO de tres letras (`USD`, `MXN`).
"""
struct AssetDetails
    name::String
    market::String
    category::String
    currency::String

    function AssetDetails(name::AbstractString, market::AbstractString, category::AbstractString,
                          currency::AbstractString)
        fields = (("name", name), ("market", market), ("category", category), ("currency", currency))
        cleaned = map(fields) do (field, value)
            any(iscntrl, value) && throw(ArgumentError("$field must not contain control characters"))
            value = strip(value)
            isempty(value) && throw(ArgumentError("$field must not be empty"))
            String(value)
        end
        currency = uppercase(cleaned[4])
        occursin(CURRENCY_PATTERN, currency) ||
            throw(ArgumentError("currency must be a three-letter ISO code such as USD or MXN"))
        return new(cleaned[1], uppercase(cleaned[2]), cleaned[3], currency)
    end
end

Base.:(==)(a::AssetDetails, b::AssetDetails) =
    (a.name, a.market, a.category, a.currency) == (b.name, b.market, b.category, b.currency)

"""
Estado de una importación, como se guarda en `sincronizaciones`: `:success` (todas las
filas válidas), `:partial` (hubo filas inválidas, pero se guardó el resto) o `:failed`
(ninguna fila válida).
"""
const IMPORT_STATUSES = (:success, :partial, :failed)

"""
Puerto de persistencia de precios. Cada adaptador implementa

    save_price_import(repository, symbol, details, bars, status, failed_rows, message; source=:csv)
        -> (asset_id, inserted)

que, en una sola operación, crea o actualiza el activo (`symbol` en `details.market`),
guarda las barras que todavía no existen para ese activo, fecha y origen (RF-05),
y registra la importación con ese origen (RF-06). `source` es uno de
[`PRICE_SOURCES`](@ref). Si `bars` está vacío no toca el activo (`details` puede ser
`nothing`) y devuelve `(nothing, 0)`, pero igual registra la importación.

    latest_price_date(repository, symbol; source=:api) -> Union{Nothing,Date}

devuelve la fecha del último precio guardado de `symbol` (en cualquier mercado) con ese
origen, o `nothing` si no hay ninguno.
"""
abstract type PriceRepository end

"""Origen de un precio, como el enum `origen_precio` de la base: `:csv` o `:api`."""
const PRICE_SOURCES = (:csv, :api)

function save_price_import end
function latest_price_date end

function check_import(details, bars, status::Symbol, source::Symbol)
    status in IMPORT_STATUSES || throw(ArgumentError("unknown import status $status"))
    source in PRICE_SOURCES || throw(ArgumentError("unknown price source $source"))
    isempty(bars) || details isa AssetDetails || throw(ArgumentError("prices need the asset details"))
    return nothing
end

"""
Lecturas del catálogo para las páginas de admin, que también implementa cada adaptador
de [`PriceRepository`](@ref):

- `list_assets(repository)`: un `NamedTuple` por activo con `id`, `symbol`, `name`,
  `market`, `category`, `currency`, `last_synced_at`, `price_rows`, `first_date` y
  `last_date`, ordenados por mercado y símbolo.
- `list_imports(repository; limit)`: las últimas importaciones, de la más nueva a la más
  vieja, con `id`, `source`, `status`, `asset_symbol`, `asset_market`, `saved`, `failed`,
  `message`, `started_at` y `finished_at`.
"""
function list_assets end
function list_imports end

"""
    PriceImportSummary

Resultado de [`import_prices`](@ref): el símbolo y el id del activo (`nothing` si no se
guardó nada), las filas válidas del archivo, cuántas se guardaron, cuántas ya existían,
las filas inválidas y repetidas dentro del archivo, y el estado (`:success`, `:partial`
o `:failed`).
"""
struct PriceImportSummary
    symbol::Union{Nothing,String}
    asset_id::Union{Nothing,Int}
    valid_rows::Int
    inserted::Int
    already_stored::Int
    invalid::Vector{ImportIssue}
    file_duplicates::Vector{ImportIssue}
    status::Symbol
end

"""
    import_prices(prices::PriceRepository, io, details::AssetDetails; symbol=nothing, columns=Dict())
        -> PriceImportSummary

Caso de uso de carga de precios (RF-01, RF-02, RF-05, RF-06). Lee el CSV con
[`parse_prices_csv`](@ref) y guarda sus filas válidas como un solo activo.

- El archivo debe ser de **un solo activo**: si trae varios símbolos, lanza `ArgumentError`
  sin guardar nada. Sin columna de símbolo, se usa `symbol`; si hay columna y además se
  indica `symbol`, deben coincidir.
- Las filas inválidas no detienen la carga: la importación queda `:partial`. Si no hay
  ninguna fila válida, queda `:failed` y no se crea el activo.
- Volver a importar el mismo archivo no duplica precios: las filas ya guardadas se cuentan
  en `already_stored`.
"""
function import_prices(prices::PriceRepository, io::IO, details::AssetDetails;
                       symbol::Union{Nothing,AbstractString}=nothing,
                       columns::AbstractDict=Dict{String,String}())
    expected = symbol === nothing ? nothing : uppercase(strip(symbol))
    parsed = parse_prices_csv(io; columns, symbol=expected)
    symbols = sort!(unique(bar.symbol for bar in parsed.bars))
    length(symbols) > 1 &&
        throw(ArgumentError("import one asset per file; found $(join(symbols, ", "))"))
    file_symbol = isempty(symbols) ? expected : only(symbols)
    expected !== nothing && file_symbol != expected &&
        throw(ArgumentError("the file contains $file_symbol but the asset is $expected"))

    status = isempty(parsed.bars) ? :failed : isempty(parsed.errors) ? :success : :partial
    message = status == :success ? nothing :
              status == :failed ? "no valid rows ($(length(parsed.errors)) invalid rows)" :
              "$(length(parsed.errors)) invalid rows; first at line $(first(parsed.errors).line): $(first(parsed.errors).message)"

    asset_id, inserted = save_price_import(prices, file_symbol, details, parsed.bars, status,
                                           length(parsed.errors), message)
    return PriceImportSummary(file_symbol, asset_id, length(parsed.bars), inserted,
                              length(parsed.bars) - inserted, parsed.errors, parsed.duplicates, status)
end

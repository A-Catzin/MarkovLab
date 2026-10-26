# Adaptador CSV de precios históricos (RF-02, RF-05). Traduce el formato del archivo
# externo a valores `PriceBar` del dominio. Formato y reglas en
# documentacion/tecnica/IMPORTACION_CSV.md.

const PRICE_COLUMNS = ("symbol", "date", "open", "high", "low", "close", "volume")
const PRICE_DATE_FORMAT = dateformat"yyyy-mm-dd"

"""
    ImportIssue(line, message)

Una fila que no se importó. `line` es el número de línea en el archivo, contado desde 1.
"""
struct ImportIssue
    line::Int
    message::String
end

"""
    PriceImportResult

Resultado de una importación CSV: `bars` contiene las filas válidas y únicas
ordenadas por símbolo y fecha; `errors`, las filas inválidas; `duplicates`, las filas
descartadas porque una fila anterior tenía el mismo símbolo y fecha.
"""
struct PriceImportResult
    bars::Vector{PriceBar}
    errors::Vector{ImportIssue}
    duplicates::Vector{ImportIssue}
end

# Divide una línea CSV por comas, respetando campos entre comillas dobles y el escape "".
function split_csv_line(line::AbstractString)
    fields = String[]
    buffer = IOBuffer()
    in_quotes = false
    chars = collect(line)
    i = 1
    while i <= length(chars)
        c = chars[i]
        if in_quotes
            if c == '"' && i < length(chars) && chars[i + 1] == '"'
                print(buffer, '"')
                i += 1
            elseif c == '"'
                in_quotes = false
            else
                print(buffer, c)
            end
        elseif c == '"'
            in_quotes = true
        elseif c == ','
            push!(fields, String(take!(buffer)))
        else
            print(buffer, c)
        end
        i += 1
    end
    push!(fields, String(take!(buffer)))
    return fields
end

function resolve_columns(header::Vector{String}, columns::AbstractDict, symbol)
    normalized = [lowercase(strip(name)) for name in header]
    indexes = Dict{String,Int}()
    missing_columns = String[]
    for column in PRICE_COLUMNS
        expected = lowercase(strip(get(columns, column, column)))
        index = findfirst(==(expected), normalized)
        if index !== nothing
            indexes[column] = index
        elseif !(column == "symbol" && symbol !== nothing)
            push!(missing_columns, expected)
        end
    end
    isempty(missing_columns) ||
        throw(ArgumentError("CSV is missing required columns: $(join(missing_columns, ", "))"))
    return indexes
end

function parse_price_field(fields, indexes, column)
    raw = strip(fields[indexes[column]])
    value = tryparse(Float64, raw)
    value === nothing && throw(ArgumentError("invalid $column value \"$raw\""))
    return value
end

function parse_price_row(fields, indexes, expected_fields, symbol)
    length(fields) < expected_fields &&
        throw(ArgumentError("expected $expected_fields fields, got $(length(fields))"))
    raw_date = strip(fields[indexes["date"]])
    date = tryparse(Date, raw_date, PRICE_DATE_FORMAT)
    date === nothing && throw(ArgumentError("invalid date \"$raw_date\", expected YYYY-MM-DD"))
    row_symbol = haskey(indexes, "symbol") ? fields[indexes["symbol"]] : symbol
    return PriceBar(row_symbol, date,
                    parse_price_field(fields, indexes, "open"),
                    parse_price_field(fields, indexes, "high"),
                    parse_price_field(fields, indexes, "low"),
                    parse_price_field(fields, indexes, "close"),
                    parse_price_field(fields, indexes, "volume"))
end

"""
    parse_prices_csv(io; columns=Dict(), symbol=nothing) -> PriceImportResult

Lee precios históricos de un flujo CSV con un encabezado que contenga
`symbol,date,open,high,low,close,volume` (sin distinguir mayúsculas, en cualquier
orden; las columnas adicionales se ignoran).

- `columns` asocia los nombres internos con los encabezados del proveedor, por
  ejemplo `Dict("close" => "Adj Close")`.
- `symbol` indica el símbolo del activo cuando el archivo no tiene columna de símbolo.

Las filas inválidas se informan en `errors` y las filas con símbolo y fecha
repetidos en `duplicates`; ninguna detiene la importación. Si falta una columna
obligatoria o el archivo está vacío, se lanza `ArgumentError`.
"""
function parse_prices_csv(io::IO; columns::AbstractDict=Dict{String,String}(),
                          symbol::Union{Nothing,AbstractString}=nothing)
    lines = readlines(io)
    header_line = findfirst(line -> !isempty(strip(line)), lines)
    header_line === nothing && throw(ArgumentError("CSV is empty"))
    header = split_csv_line(lstrip(lines[header_line], '﻿'))
    indexes = resolve_columns(header, columns, symbol)
    expected_fields = maximum(values(indexes))

    bars = PriceBar[]
    errors = ImportIssue[]
    duplicates = ImportIssue[]
    seen = Set{Tuple{String,Date}}()
    for line_number in (header_line + 1):length(lines)
        line = lines[line_number]
        isempty(strip(line)) && continue
        bar = try
            parse_price_row(split_csv_line(line), indexes, expected_fields, symbol)
        catch err
            err isa ArgumentError || rethrow()
            push!(errors, ImportIssue(line_number, err.msg))
            continue
        end
        key = (bar.symbol, bar.date)
        if key in seen
            push!(duplicates, ImportIssue(line_number,
                "duplicate price for $(bar.symbol) on $(bar.date); first occurrence kept"))
        else
            push!(seen, key)
            push!(bars, bar)
        end
    end
    sort!(bars; by=bar -> (bar.symbol, bar.date))
    return PriceImportResult(bars, errors, duplicates)
end

"""
    read_prices_csv(path; kwargs...) -> PriceImportResult

Abre el archivo en `path` y lo importa con [`parse_prices_csv`](@ref).
"""
read_prices_csv(path::AbstractString; kwargs...) = open(io -> parse_prices_csv(io; kwargs...), path)

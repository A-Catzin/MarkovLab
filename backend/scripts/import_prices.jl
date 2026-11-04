# Importa precios históricos de un CSV a la base (activos, precios_historicos y
# sincronizaciones). Un archivo por activo, con el formato de
# documentacion/datos/diccionario-datos.md.
#
# Uso desde la raíz del repositorio, con DATABASE_URL en el entorno:
#   set -a; source backend/.env; set +a
#   julia --project=backend backend/scripts/import_prices.jl datos/AAPL.csv \
#       --nombre "Apple Inc." --mercado NASDAQ --categoria Acción --moneda USD
#
# Opcional: --simbolo AAPL, si el CSV no tiene columna Symbol (o para comprobar que coincide).
# Volver a importar el mismo archivo no duplica precios.
#
# Código de salida: 0 si se guardó (completa o parcial), 1 si falló o faltan datos.

using MarkovLabBackend

const USAGE = """
Uso: julia --project=backend backend/scripts/import_prices.jl ARCHIVO.csv \\
         --nombre NOMBRE --mercado MERCADO --categoria CATEGORIA --moneda MONEDA [--simbolo SIMBOLO]

  --nombre     Nombre del activo, por ejemplo "Apple Inc."
  --mercado    Mercado donde cotiza, por ejemplo NASDAQ o BMV
  --categoria  Categoría, por ejemplo Acción, ETF o Cripto
  --moneda     Código ISO de tres letras, por ejemplo USD o MXN
  --simbolo    Opcional: símbolo, si el CSV no tiene columna Symbol

Requiere DATABASE_URL en el entorno.
"""

const OPTIONS = ("--nombre", "--mercado", "--categoria", "--moneda", "--simbolo")

fail(message) = (println(stderr, "Error: ", message); println(stderr); print(stderr, USAGE); exit(1))

"""Separa el archivo y las opciones `--clave valor`; rechaza opciones desconocidas o sin valor."""
function parse_arguments(args)
    path = nothing
    options = Dict{String,String}()
    i = 1
    while i <= length(args)
        arg = args[i]
        if arg in ("-h", "--help")
            print(USAGE)
            exit(0)
        elseif startswith(arg, "--")
            arg in OPTIONS || fail("opción desconocida $arg")
            i < length(args) || fail("falta el valor de $arg")
            options[arg] = args[i + 1]
            i += 2
        else
            path === nothing || fail("indica un solo archivo")
            path = arg
            i += 1
        end
    end
    path === nothing && fail("falta el archivo CSV")
    missing_options = [o for o in OPTIONS[1:4] if !haskey(options, o)]
    isempty(missing_options) || fail("faltan opciones: $(join(missing_options, ", "))")
    return path, options
end

function main(args)
    path, options = parse_arguments(args)
    isfile(path) || fail("no existe el archivo $path")
    database_url = strip(get(ENV, "DATABASE_URL", ""))
    isempty(database_url) && fail("falta DATABASE_URL en el entorno")

    details, prices = try
        (AssetDetails(options["--nombre"], options["--mercado"], options["--categoria"], options["--moneda"]),
         PostgresPriceRepository(database_url))
    catch err
        err isa ArgumentError || rethrow()
        fail(err.msg)
    end

    summary = try
        open(io -> import_prices(prices, io, details; symbol=get(options, "--simbolo", nothing)), path)
    catch err
        err isa ArgumentError || rethrow()
        fail(err.msg)
    finally
        close(prices)
    end

    labels = Dict(:success => "completa", :partial => "parcial (con filas inválidas)", :failed => "fallida")
    println("Importación $(labels[summary.status]) de $(something(summary.symbol, "?")) en $(details.market)")
    println("  Filas válidas:         $(summary.valid_rows)")
    println("  Guardadas:             $(summary.inserted)")
    println("  Ya estaban guardadas:  $(summary.already_stored)")
    println("  Inválidas:             $(length(summary.invalid))")
    println("  Repetidas en archivo:  $(length(summary.file_duplicates))")
    for issue in Iterators.take(summary.invalid, 10)
        println("    línea $(issue.line): $(issue.message)")
    end
    length(summary.invalid) > 10 && println("    … y $(length(summary.invalid) - 10) más")
    exit(summary.status == :failed ? 1 : 0)
end

main(ARGS)

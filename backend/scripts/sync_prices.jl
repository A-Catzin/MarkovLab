# Trae precios diarios desde Apify (Yahoo Finance) a la base, sin CSV: activos,
# precios_historicos (origen 'api') y sincronizaciones. Detalles en
# documentacion/tecnica/PRECIOS_API.md.
#
# Uso desde la raíz del repositorio, con DATABASE_URL y APIFY_TOKEN en el entorno:
#   set -a; source backend/.env; set +a
#   julia --project=backend backend/scripts/sync_prices.jl AAPL WALMEX.MX --desde 2000-01-01   # carga histórica
#   julia --project=backend backend/scripts/sync_prices.jl AAPL WALMEX.MX                      # actualización
#   julia --project=backend backend/scripts/sync_prices.jl --catalogo                          # actualiza todo el catálogo
#
# Código de salida: 0 si todo se guardó (o ya estaba al día), 1 si algún símbolo falló.

using Dates
using MarkovLabBackend

const USAGE = """
Uso: julia --project=backend backend/scripts/sync_prices.jl SIMBOLO... [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD]
     julia --project=backend backend/scripts/sync_prices.jl --catalogo [--desde AAAA-MM-DD] [--hasta AAAA-MM-DD]

  SIMBOLO     Símbolos de Yahoo Finance, por ejemplo AAPL o WALMEX.MX (máximo $(MAX_SYNC_SYMBOLS))
  --catalogo  Usa los símbolos de todos los activos del catálogo
  --desde     Carga histórica desde esa fecha. Sin ella, cada símbolo sigue desde su
              último precio guardado (o desde $(MARKET_HISTORY_START) si no tiene)
  --hasta     Último día a traer (por defecto, ayer: el día en curso nunca se guarda)

Requiere DATABASE_URL y APIFY_TOKEN en el entorno. Apify cobra unos \$0.0005 por símbolo y corrida.
"""

fail(message) = (println(stderr, "Error: ", message); println(stderr); print(stderr, USAGE); exit(1))

function parse_date(value, option)
    try
        Date(value, dateformat"yyyy-mm-dd")
    catch
        fail("$option debe ser una fecha AAAA-MM-DD, no $value")
    end
end

"""Separa los símbolos y las opciones; rechaza opciones desconocidas o sin valor."""
function parse_arguments(args)
    symbols = String[]
    options = Dict{String,String}()
    catalog = false
    i = 1
    while i <= length(args)
        arg = args[i]
        if arg in ("-h", "--help")
            print(USAGE)
            exit(0)
        elseif arg == "--catalogo"
            catalog = true
            i += 1
        elseif arg in ("--desde", "--hasta")
            i < length(args) || fail("falta el valor de $arg")
            options[arg] = args[i + 1]
            i += 2
        elseif startswith(arg, "--")
            fail("opción desconocida $arg")
        else
            push!(symbols, arg)
            i += 1
        end
    end
    catalog && !isempty(symbols) && fail("usa --catalogo o una lista de símbolos, no los dos")
    !catalog && isempty(symbols) && fail("indica al menos un símbolo o --catalogo")
    from = haskey(options, "--desde") ? parse_date(options["--desde"], "--desde") : nothing
    to = haskey(options, "--hasta") ? parse_date(options["--hasta"], "--hasta") : Dates.today() - Day(1)
    return symbols, catalog, from, to
end

function main(args)
    symbols, catalog, from, to = parse_arguments(args)
    database_url = strip(get(ENV, "DATABASE_URL", ""))
    isempty(database_url) && fail("falta DATABASE_URL en el entorno")
    token = strip(get(ENV, "APIFY_TOKEN", ""))
    isempty(token) && fail("falta APIFY_TOKEN en el entorno")

    prices = PostgresPriceRepository(database_url)
    result = try
        catalog && (symbols = unique([asset.symbol for asset in list_assets(prices)]))
        catalog && isempty(symbols) && fail("el catálogo no tiene activos")
        sync_market_prices(prices, ApifyMarketData(token), symbols; from, to)
    catch err
        err isa ArgumentError || rethrow()
        fail(err.msg)
    finally
        close(prices)
    end

    labels = Dict(:success => "completa", :partial => "parcial", :failed => "fallida")
    for summary in result.fetched
        println("$(rpad(something(summary.symbol, "?"), 12)) $(rpad(labels[summary.status], 9)) ",
                "$(summary.inserted) nuevos, $(summary.already_stored) ya guardados, $(length(summary.invalid)) inválidos",
                get(result.corrected, summary.symbol, 0) > 0 ? ", $(result.corrected[summary.symbol]) corregidos al cierre" : "")
        for issue in Iterators.take(summary.invalid, 3)
            println("    fila $(issue.line): $(issue.message)")
        end
    end
    isempty(result.up_to_date) || println("Al día, sin precios nuevos: ", join(result.up_to_date, ", "))
    any(summary.status == :failed for summary in result.fetched) &&
        println(stderr, "Algún símbolo falló: revisa /admin/importaciones para ver el motivo.")
    exit(any(summary.status == :failed for summary in result.fetched) ? 1 : 0)
end

main(ARGS)

# Consumidor de RF-12. Corre una sola tanda, por ejemplo como tarea programada.
using MarkovLabBackend
using MarkovLabBackend: PostgresWatchlist, process_market_refresh!

if ARGS in (["--help"], ["-h"])
    println("Uso: julia --project=. scripts/process_market_refresh.jl")
    println("Requiere MARKET_REFRESH_WORKER_ENABLED=true, DATABASE_URL y APIFY_TOKEN.")
    exit(0)
end

isempty(ARGS) || error("Argumentos no válidos. Para ver el uso, indica --help.")
get(ENV, "MARKET_REFRESH_WORKER_ENABLED", "") == "true" || error("El consumidor de actualizaciones no está habilitado.")
database = strip(get(ENV, "DATABASE_URL", ""))
token = strip(get(ENV, "APIFY_TOKEN", ""))
isempty(database) && error("Falta DATABASE_URL.")
isempty(token) && error("Falta APIFY_TOKEN.")
prices = PostgresPriceRepository(database)
result = try
    process_market_refresh!(PostgresWatchlist(prices.db), prices, ApifyMarketData(token))
finally
    close(prices)
end
println("Actualizaciones completadas: $(result.completed); fallidas: $(result.failed).")
exit(result.failed == 0 ? 0 : 1)

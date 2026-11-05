# Importación de precios desde CSV

Referencia del importador de precios históricos del backend. Cubre RF-02 (importar CSV), RF-05 (evitar duplicados por activo y fecha) y la sección 6.4 del [SRS](../contexto/SRS.md).

| Archivo | Capa | Responsabilidad |
|---|---|---|
| `backend/src/domain/prices.jl` | Dominio | `PriceBar`: una observación OHLCV válida. |
| `backend/src/infrastructure/csv_prices.jl` | Infraestructura | Lectura del CSV y traducción a `PriceBar`. |
| `backend/src/domain/assets.jl` | Dominio | `AssetDetails` (nombre, mercado, categoría, moneda) y el puerto `PriceRepository`. |
| `backend/src/services/prices.jl` | Servicio | `import_prices`: CSV → activo + precios + registro de la importación. |
| `backend/src/infrastructure/postgres_prices.jl` | Infraestructura | `PostgresPriceRepository` sobre `activos`, `precios_historicos` y `sincronizaciones`. |
| `backend/scripts/import_prices.jl` | Script | Carga de un archivo desde la terminal. |

## Cargar un CSV a la base

Un archivo por activo, con el formato de [`diccionario-datos.md`](../datos/diccionario-datos.md). El CSV no trae el nombre, el mercado, la categoría ni la moneda del activo, así que se pasan como opciones:

```bash
set -a; source backend/.env; set +a        # DATABASE_URL
julia --project=backend backend/scripts/import_prices.jl datos/AAPL.csv \
    --nombre "Apple Inc." --mercado NASDAQ --categoria Acción --moneda USD
```

```text
Importación completa de AAPL en NASDAQ
  Filas válidas:         1258
  Guardadas:             1258
  Ya estaban guardadas:  0
  Inválidas:             0
  Repetidas en archivo:  0
```

- `--simbolo AAPL` es opcional: sirve si el CSV no tiene columna `Symbol`, o para comprobar que el archivo es del activo esperado.
- **Volver a importar el mismo archivo no duplica precios** (RF-05): las filas ya guardadas aparecen en "Ya estaban guardadas". Así se puede reimportar un archivo actualizado sin miedo.
- Las filas inválidas no detienen la carga: se informan con su línea y la importación queda **parcial**. Si ninguna fila es válida, queda **fallida** y no se crea el activo.
- Un archivo con varios símbolos se rechaza completo, sin guardar nada.
- El mercado y la moneda se guardan siempre en mayúsculas: `--mercado nasdaq` y `--mercado NASDAQ` son el mismo activo.
- El código de salida es 0 si se guardó (completa o parcial) y 1 si falló.

Qué hace en la base, en **una sola transacción** (o se guarda todo o nada):

1. **`activos`:** busca el activo por mercado y símbolo (SRS 7.2). Si no existe lo crea, y si existe actualiza su nombre, categoría y moneda. En ambos casos fija `ultima_sincronizacion` (RF-04).
2. **`precios_historicos`:** inserta todas las filas en una sola consulta (`unnest` de arreglos) con origen `csv`. Las que ya existen para el mismo activo, fecha y origen se omiten con `ON CONFLICT DO NOTHING`.
   Si el CSV trae `Adj Close`, se guarda en `cierre_ajustado` (migración `0002`, aplicada).
3. **`sincronizaciones`:** registra la importación con su estado (`exitosa`, `parcial` o `fallida`), las filas guardadas y fallidas, y un mensaje con la primera fila inválida (RF-06).

Si la conexión con Supabase se corta a mitad de camino, la transacción se revierte y se reintenta una vez.

Desde Julia:

```julia
prices = PostgresPriceRepository(ENV["DATABASE_URL"])
details = AssetDetails("Apple Inc.", "NASDAQ", "Acción", "USD")
summary = open(io -> import_prices(prices, io, details), "AAPL.csv")
summary.status    # :success, :partial o :failed
summary.inserted  # filas nuevas
```

## Uso rápido

```julia
using MarkovLabBackend

result = read_prices_csv("precios.csv")

result.bars        # Vector{PriceBar} válidos, únicos y ordenados por símbolo y fecha
result.errors      # Vector{ImportIssue}: filas inválidas (línea + motivo)
result.duplicates  # Vector{ImportIssue}: filas descartadas por duplicadas

closes = [b.close for b in result.bars if b.symbol == "AAPL"]
simple_returns(closes)
```

## Formato esperado

```text
symbol,date,open,high,low,close,volume
AAPL,2026-01-02,98.0,100.5,97.5,100.0,1200
```

- La primera línea no vacía es el encabezado.
- Los nombres de columna no distinguen mayúsculas y pueden estar en cualquier orden.
- `Adj Close` es opcional: si la columna existe, se guarda como cierre ajustado (`cierre_ajustado`), y un valor vacío en una fila queda en NULL. Un valor no numérico invalida la fila. No se compara con el máximo y el mínimo del día, porque descuenta dividendos y splits posteriores.
- Las demás columnas (`Dividends`, `Stock Splits`) se ignoran.
- Fechas en formato ISO `YYYY-MM-DD`.
- Números con punto decimal y sin separador de miles.
- Se admiten campos entre comillas dobles (`"BRK,B"`), comillas escapadas (`""`), saltos de línea `\r\n`, BOM UTF-8 y líneas vacías.
- No se admiten saltos de línea dentro de un campo.

## Adaptar el formato de un proveedor

Según el SRS, los nombres pueden adaptarse al proveedor con una transformación documentada. Para eso existen dos parámetros opcionales:

```julia
# Encabezados con otros nombres
read_prices_csv("export.csv";
    columns=Dict("symbol" => "ticker", "date" => "day", "adj_close" => "Ajustado"))

# Archivo de un solo activo sin columna symbol (por ejemplo, exportaciones por ticker)
read_prices_csv("aapl.csv"; symbol="AAPL")
```

`columns` asocia el nombre interno con el encabezado del archivo; las columnas no indicadas usan su nombre interno. `symbol` solo se usa si el archivo no tiene columna de símbolo.

## Reglas de validación

Cada fila se convierte en un `PriceBar`, cuyo constructor exige:

| Regla | Ejemplo rechazado |
|---|---|
| Símbolo no vacío; se normaliza a mayúsculas sin espacios. | `,2026-01-02,...` |
| Fecha válida `YYYY-MM-DD`. | `02/01/2026` |
| `open`, `high`, `low` y `close` numéricos, finitos y positivos. | `abc`, `0`, `-5` |
| `high` ≥ `open`, `low` y `close`. | `open=404, high=401` |
| `low` ≤ `open` y `close`. | `low=5.5, open=5` |
| `volume` numérico, finito y no negativo. | `-1` |
| La fila tiene todos los campos necesarios. | Fila con 5 de 7 campos |

## Política de importación

| Situación | Resultado |
|---|---|
| Fila válida | Se agrega a `bars`. |
| Fila inválida | Se agrega a `errors` con su número de línea y motivo; la importación continúa. |
| Mismo símbolo y fecha que una fila anterior | Se conserva la **primera** aparición y la repetida se agrega a `duplicates` (RF-05). |
| Falta una columna obligatoria o el archivo está vacío | Se lanza `ArgumentError` y no se importa nada. |

Los números de línea cuentan desde 1 e incluyen el encabezado y las líneas vacías, para que coincidan con lo que se ve en un editor.

`bars` se devuelve ordenado por símbolo y fecha ascendente, como requieren los cálculos temporales (SRS 7.2).

## Tipos

| Tipo | Campos |
|---|---|
| `PriceBar` | `symbol::String`, `date::Date`, `open`, `high`, `low`, `close`, `volume` (`Float64`) |
| `ImportIssue` | `line::Int`, `message::String` |
| `PriceImportResult` | `bars`, `errors`, `duplicates` |

## Funciones

| Función | Descripción |
|---|---|
| `read_prices_csv(path; columns, symbol)` | Abre el archivo y lo importa. |
| `parse_prices_csv(io; columns, symbol)` | Importa desde cualquier `IO` (archivo, `IOBuffer`, cuerpo HTTP). |

## Límites actuales

- La carga es desde la terminal; todavía no hay endpoint ni pantalla para subir un CSV.
- Un archivo por activo.
- `Dividends` y `Stock Splits` se ignoran por ahora.

## Pruebas

- `backend/test/domain/prices_tests.jl`: invariantes de `PriceBar`.
- `backend/test/infrastructure/csv_prices_tests.jl`: formato, errores por línea, duplicados, mapeo de columnas, comillas, CRLF y BOM.
- `backend/test/fixtures/prices_sample.csv`: archivo de ejemplo con un duplicado (línea 5) y una fila inválida (línea 6).
- `backend/test/services/prices_import_tests.jl`: `AssetDetails`, estados completa, parcial y fallida, reimportación sin duplicados y un activo por archivo, con el adaptador en memoria.
- `backend/test/infrastructure/postgres_prices_tests.jl`: integración con PostgreSQL real. Corre solo con `TEST_DATABASE_URL`, sobre el esquema oficial `database/migrations/esquema.sql`.

```bash
julia --project=backend backend/test/runtests.jl
```

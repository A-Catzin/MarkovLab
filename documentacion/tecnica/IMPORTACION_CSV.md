# Importación de precios desde CSV

Referencia del importador de precios históricos del backend. Cubre RF-02 (importar CSV), RF-05 (evitar duplicados por activo y fecha) y la sección 6.4 del [SRS](../contexto/SRS.md).

| Archivo | Capa | Responsabilidad |
|---|---|---|
| `backend/src/domain/prices.jl` | Dominio | `PriceBar`: una observación OHLCV válida. |
| `backend/src/infrastructure/csv_prices.jl` | Infraestructura | Lectura del CSV y traducción a `PriceBar`. |

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
- Los nombres de columna no distinguen mayúsculas, pueden estar en cualquier orden y las columnas adicionales se ignoran (por ejemplo `Adj Close`).
- Fechas en formato ISO `YYYY-MM-DD`.
- Números con punto decimal y sin separador de miles.
- Se admiten campos entre comillas dobles (`"BRK,B"`), comillas escapadas (`""`), saltos de línea `\r\n`, BOM UTF-8 y líneas vacías.
- No se admiten saltos de línea dentro de un campo.

## Adaptar el formato de un proveedor

Según el SRS, los nombres pueden adaptarse al proveedor con una transformación documentada. Para eso existen dos parámetros opcionales:

```julia
# Encabezados con otros nombres
read_prices_csv("export.csv";
    columns=Dict("symbol" => "ticker", "date" => "day", "close" => "Adj Close"))

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

- No persiste en PostgreSQL; la deduplicación es dentro del archivo. La restricción entre importaciones corresponderá a la base de datos (precio único por activo, fecha y fuente).
- No registra la fuente ni la fecha de importación (RF-04); se agregará al persistir.
- No valida que el símbolo exista como activo registrado (RF-01).

## Pruebas

- `backend/test/domain/prices_tests.jl`: invariantes de `PriceBar`.
- `backend/test/infrastructure/csv_prices_tests.jl`: formato, errores por línea, duplicados, mapeo de columnas, comillas, CRLF y BOM.
- `backend/test/fixtures/prices_sample.csv`: archivo de ejemplo con un duplicado (línea 5) y una fila inválida (línea 6).

```bash
julia --project=backend backend/test/runtests.jl
```

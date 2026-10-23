

# Diccionario de Datos – CSV de Precios

Este documento describe el significado de cada columna que deben tener los archivos CSV de precios históricos utilizados en MarkovLab.

## Columnas principales

| Columna       | Tipo de dato     | Obligatorio | Descripción                                                                 | Ejemplo          |
|---------------|------------------|-------------|-----------------------------------------------------------------------------|------------------|
| `Date`        | Fecha (YYYY-MM-DD) | Sí        | Fecha de la cotización. Debe ser única por activo.                          | `2024-03-15`     |
| `Open`        | Número decimal   | Sí          | Precio de apertura del día.                                                 | `178.45`         |
| `High`        | Número decimal   | Sí          | Precio máximo alcanzado durante el día.                                     | `180.20`         |
| `Low`         | Número decimal   | Sí          | Precio mínimo alcanzado durante el día.                                     | `177.80`         |
| `Close`       | Número decimal   | Sí          | Precio de cierre del día.                                                   | `179.10`         |
| `Adj Close`   | Número decimal   | Recomendado | Precio de cierre ajustado por dividendos y splits.                          | `179.10`         |
| `Volume`      | Número entero    | Sí          | Cantidad de acciones negociadas durante el día.                             | `52430000`       |
| `Symbol`      | Texto            | Sí          | Símbolo o ticker del activo (ejemplo: AAPL, MSFT, BTC-USD).                 | `AAPL`           |

## Columnas opcionales (futuras)

| Columna       | Tipo de dato     | Descripción                                      |
|---------------|------------------|--------------------------------------------------|
| `Dividends`   | Número decimal   | Dividendos pagados en esa fecha (si aplica).     |
| `Stock Splits`| Número decimal   | Factor de split aplicado (si aplica).            |

## Reglas de calidad

1. **Fecha**: No puede haber dos registros con la misma fecha y el mismo `Symbol`.
2. **Precios**: `High` debe ser ≥ `Open`, `Close` y `Low`. `Low` debe ser ≤ todos los demás precios del día.
3. **Volumen**: Debe ser un número ≥ 0.
4. **Valores nulos**: No se permiten valores vacíos en las columnas obligatorias.
5. **Orden**: Se recomienda que los registros estén ordenados por fecha ascendente.

## Ejemplo de fila válida

```csv
Date,Open,High,Low,Close,Adj Close,Volume,Symbol
2024-06-10,192.50,194.80,191.20,193.75,193.75,48215000,AAPL

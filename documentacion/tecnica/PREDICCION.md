# Predicción de referencia (B6)

`empirical_stationary_v1` usa una mediana y una banda empírica fija del 90 % para las próximas 21, 63 o 126 sesiones. Es una referencia que no presupone tendencia: **no garantiza resultados ni cobertura futura**.

| Decisión | Regla |
|---|---|
| Entrenamiento | Usa hasta 252 cierres ajustados del activo, a la fecha de corte inclusive; exige 60 cierres. No rellena huecos. |
| Rendimiento | Rendimiento simple entre dos cierres consecutivos, expresado como fracción diaria. |
| Volatilidad | Desviación estándar muestral de los últimos 21 rendimientos, anualizada con 252 sesiones. |
| Pronóstico y banda | Mediana y cuantiles empíricos 5/95 de la métrica. La banda es para cada sesión, no para el retorno acumulado. |
| Evaluación | Usa únicamente cierres posteriores al corte, en orden real, y el anclaje del pronóstico guardado. Muestra MAE, RMSE y proporción dentro de la banda cuando hay observaciones. |

La distribución futura puede diferir de la histórica. En volatilidad, las ventanas de 21 sesiones se solapan, por lo que sus observaciones no son independientes. La evaluación se limita a las sesiones disponibles, sin tratar feriados o datos faltantes como cierres reales.

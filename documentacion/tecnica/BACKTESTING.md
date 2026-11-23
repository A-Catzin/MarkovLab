# Backtesting fuera de muestra (B7)

La estrategia fija sus pesos en una ventana de configuración y los evalúa en una ventana posterior y disjunta. Con mínima varianza o máximo Sharpe, los momentos de los rendimientos se estiman **solo con la ventana de configuración**. La estrategia manual usa los pesos de la cartera seleccionada. Un cambio en precios de evaluación no debe cambiar los pesos.

- **Ventanas:** ambas incluyen sus extremos y necesitan tres cierres comunes como mínimo. No se rellenan huecos. El benchmark, si se elige, se alinea con la estrategia solo en evaluación.
- **Índices:** cada fase parte de 100 antes de costes. La curva de configuración es ilustrativa, no es rendimiento fuera de muestra. El benchmark es de compra y mantenimiento, sin costes.
- **Rebalanceos:** ninguno, mensual, trimestral o semestral. Se marcan las posiciones al primer cierre común del nuevo período y luego se vuelve a los pesos objetivo; no se opera en el último cierre.
- **Costos:** 100 % de rotación al entrar y la mitad de la suma de cambios absolutos de pesos en cada rebalanceo. El coste en pb multiplica esa rotación. No se simulan deslizamiento, impuestos ni liquidación final.
- **Métricas de evaluación:** rendimiento acumulado y anualizado compuesto, volatilidad muestral anualizada (252 sesiones), drawdown máximo como fracción no positiva y Sharpe anualizado aritmético, nulo cuando la volatilidad es cero. El coste de entrada se incluye en el primer retorno medido, sin inventar una sesión.

La separación de ventanas evita usar los retornos de evaluación para calibrar pesos. No corrige por sí sola el sesgo de selección: elegir activos o pesos manuales con información conocida después de la fecha de configuración puede volver optimista el resultado.

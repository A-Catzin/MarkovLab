import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const metadata: Metadata = {
  title: "Backtesting",
  description: "Prueba una estrategia con precios históricos y compárala con un benchmark.",
};

export default function BacktestingPage() {
  return (
    <ModulePlaceholder
      title="Backtesting"
      description="Prueba una estrategia con precios del pasado, mide su comportamiento y compárala contra un índice de referencia."
      items={[
        "Selección de período histórico y benchmark.",
        "Separación entre datos de configuración y datos de evaluación.",
        "Rendimiento acumulado, volatilidad, drawdown y ratio de Sharpe.",
        "Gráfico comparativo estrategia vs. benchmark.",
        "Guardado del resultado junto con sus parámetros.",
      ]}
      note="El backtesting necesita precios históricos validados y persistencia; depende de las etapas de datos y base de datos."
    />
  );
}

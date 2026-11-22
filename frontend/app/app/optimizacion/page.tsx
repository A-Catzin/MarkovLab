import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const metadata: Metadata = {
  title: "Optimización",
  description: "Encuentra la cartera con menos riesgo o mejor relación entre ganancia y riesgo.",
};

export default function OptimizacionPage() {
  return (
    <ModulePlaceholder
      title="Optimización"
      description="Encuentra la combinación de pesos que mejor cumple un objetivo: menos riesgo, mejor relación entre ganancia y riesgo o un nivel de riesgo máximo."
      items={[
        "Objetivo: minimizar varianza o maximizar el ratio de Sharpe.",
        "Límites mínimos y máximos por activo.",
        "Nivel máximo de volatilidad.",
        "Comparación entre la cartera manual y la optimizada.",
        "Aviso claro cuando las restricciones no tienen solución.",
      ]}
      note="El motor de optimización con JuMP e HiGHS pertenece a una etapa posterior del backend."
    />
  );
}

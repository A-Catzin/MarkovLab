import type { Metadata } from "next";
import { OptimizationManager } from "@/components/app/optimizacion/OptimizationManager";

export const metadata: Metadata = {
  title: "Optimización",
  description:
    "Encuentra la cartera matemáticamente óptima con el modelo de Markowitz: mínima varianza o máximo ratio de Sharpe.",
};

export default function OptimizacionPage() {
  return <OptimizationManager />;
}

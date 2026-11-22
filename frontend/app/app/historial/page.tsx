import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const metadata: Metadata = {
  title: "Historial",
  description: "Consulta tus simulaciones, carteras y análisis guardados.",
};

export default function HistorialPage() {
  return (
    <ModulePlaceholder
      title="Historial"
      description="Vuelve a tus simulaciones, carteras y análisis guardados para comparar decisiones y reproducir resultados."
      items={[
        "Simulaciones guardadas con semilla, parámetros y resultados.",
        "Carteras y versiones anteriores.",
        "Análisis de activos y correlaciones.",
        "Filtros por fecha, activo y tipo de análisis.",
        "Repetición de una simulación con los mismos parámetros.",
      ]}
      note="El historial requiere persistencia en PostgreSQL a través de la API Julia."
    />
  );
}

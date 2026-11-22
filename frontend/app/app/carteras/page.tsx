import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/app/ModulePlaceholder";

export const metadata: Metadata = {
  title: "Carteras",
  description: "Crea y administra carteras con tus propios activos y pesos.",
};

export default function CarterasPage() {
  return (
    <ModulePlaceholder
      title="Mis carteras"
      description="Crea carteras con tus propios activos y pesos, y guarda varias versiones para comparar decisiones sin perder la original."
      items={[
        "Nombre, capital inicial, moneda y fecha de creación.",
        "Activos y pesos con validación del 100 %.",
        "Versiones y duplicados de una misma cartera.",
        "Composición porcentual y métricas de rendimiento y riesgo.",
        "Acceso al simulador con la cartera seleccionada.",
      ]}
      note="La persistencia real llegará con la base de datos y la API Julia. Mientras tanto, el simulador trabaja con datos de ejemplo."
    />
  );
}

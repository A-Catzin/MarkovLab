import type { Metadata } from "next";
import { HistorialManager } from "@/components/app/historial/HistorialManager";

export const metadata: Metadata = {
  title: "Historial",
  description: "Consulta tus simulaciones, backtesting y carteras guardadas.",
};

export default function HistorialPage() {
  return (
    <div className="app-page">
      <header data-reveal>
        <h1>Historial</h1>
        <p className="app-page__lead">
          Vuelve a tus simulaciones, backtesting y carteras guardadas para comparar decisiones y repetir resultados con
          la misma semilla.
        </p>
      </header>

      <HistorialManager />
    </div>
  );
}

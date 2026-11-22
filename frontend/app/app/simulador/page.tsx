import type { Metadata } from "next";
import { Simulator } from "@/components/landing/Simulator";
import { runDemo } from "@/lib/demo";
import { DEFAULT_REQUEST } from "@/lib/landing-data";

export const metadata: Metadata = {
  title: "Simulador",
  description: "Simula 10,000 futuros posibles para una cartera y revisa su VaR y CVaR.",
};

export default function SimuladorPage() {
  const initial = runDemo(DEFAULT_REQUEST);

  return (
    <div className="app-page">
      <header>
        <h1>Simulador de riesgo</h1>
        <p className="app-page__lead">
          Reparte tu dinero, elige el plazo y mide cuánto podrías ganar o perder. El resultado usa el mismo modelo
          Monte Carlo que el motor de MarkovLab.
        </p>
      </header>

      <Simulator
        initial={initial}
        variant="app"
        title="Prueba una cartera"
        intro="Decide cómo repartir tu dinero entre cuatro empresas de ejemplo. La página imagina 10,000 futuros posibles y resume los mejores y los peores casos."
      />
    </div>
  );
}

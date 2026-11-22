import type { Metadata } from "next";
import { Simulator } from "@/components/landing/Simulator";
import { runDemo } from "@/lib/demo";
import { DEFAULT_CAPITAL, DEFAULT_REQUEST } from "@/lib/landing-data";

export const metadata: Metadata = {
  title: "Simulador",
  description: "Simula 10,000 futuros posibles para una cartera y revisa su VaR y CVaR.",
};

interface SimuladorPageProps {
  searchParams: Promise<{
    weights?: string;
    capital?: string;
    name?: string;
  }>;
}

export default async function SimuladorPage({ searchParams }: SimuladorPageProps) {
  const params = await searchParams;

  let weights = DEFAULT_REQUEST.weights;
  let capital = DEFAULT_CAPITAL;
  let portfolioName: string | undefined;

  if (params.weights) {
    const raw = params.weights
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v));
    const total = raw.reduce((a, b) => a + b, 0);
    if (raw.length === 4 && total === 100) {
      weights = raw;
    }
  }

  if (params.capital) {
    const parsedCap = Number(params.capital);
    if (Number.isFinite(parsedCap) && parsedCap > 0) {
      capital = parsedCap;
    }
  }

  if (params.name) {
    portfolioName = params.name;
  }

  const initial = runDemo({ ...DEFAULT_REQUEST, weights });

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
        title={portfolioName ? `Simulación: ${portfolioName}` : "Prueba una cartera"}
        intro="Decide cómo repartir tu dinero entre cuatro empresas de ejemplo. La página imagina 10,000 futuros posibles y resume los mejores y los peores casos."
        initialWeights={weights}
        initialCapital={capital}
        portfolioName={portfolioName}
      />
    </div>
  );
}

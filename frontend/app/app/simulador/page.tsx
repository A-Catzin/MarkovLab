import type { Metadata } from "next";
import { Simulator } from "@/components/landing/Simulator";
import { runDemo } from "@/lib/demo";
import { DEFAULT_REQUEST } from "@/lib/landing-data";

export const metadata: Metadata = {
  title: "Simulador · MarkovLab",
  description: "Simula 10,000 futuros de una cartera de ejemplo y mide su riesgo.",
};

/**
 * Simulador de la aplicación. Por ahora usa la cartera de ejemplo de la landing (mismo
 * modelo que el backend, calculado en el navegador); con "Mis carteras" usará carteras reales.
 */
export default function SimulatorPage() {
  const initial = runDemo(DEFAULT_REQUEST);
  return (
    <>
      <h1>Simulador</h1>
      <p className="shell__lead">
        Reparte tu dinero entre cuatro empresas de ejemplo y mira cómo podrían terminar 10,000 futuros posibles. Las
        cifras de las empresas son ilustrativas.
      </p>
      <div className="shell__simulator">
        <Simulator initial={initial} />
      </div>
    </>
  );
}

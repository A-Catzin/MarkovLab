import { SAMPLE_ASSETS, SAMPLE_CORRELATION } from "./landing-data";
import { runSimulation, type SimulationRequest } from "./simulation";

export type DemoResult = ReturnType<typeof runSimulation> & {
  request: SimulationRequest;
  elapsedMs: number | null;
};

/** Ejecuta la cartera de demostración; se usa en el servidor para el primer render y en el navegador a pedido. */
export function runDemo(request: SimulationRequest, elapsedMs: number | null = null): DemoResult {
  return { ...runSimulation(SAMPLE_ASSETS, SAMPLE_CORRELATION, request), request, elapsedMs };
}

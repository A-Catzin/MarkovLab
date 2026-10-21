import { SAMPLE_ASSETS, SAMPLE_CORRELATION } from "./landing-data";
import { runSimulation, type SimulationRequest } from "./simulation";

export type DemoResult = ReturnType<typeof runSimulation> & {
  request: SimulationRequest;
  elapsedMs: number | null;
};

/** Runs the demonstration portfolio; used on the server for the first render and in the browser on demand. */
export function runDemo(request: SimulationRequest, elapsedMs: number | null = null): DemoResult {
  return { ...runSimulation(SAMPLE_ASSETS, SAMPLE_CORRELATION, request), request, elapsedMs };
}

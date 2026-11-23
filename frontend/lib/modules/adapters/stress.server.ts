import "server-only";
import { isLocalFixturesEnabled, type AdapterResult, type ViewScenario } from "../runtime";
import type { StressTestingData } from "../types";

export async function loadStressTestingView(params: {
  actorId: string;
  portfolioId: string;
  presetId?: string;
  scenario?: ViewScenario;
}): Promise<AdapterResult<StressTestingData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildStressTestingFixture } = await import("../fixtures/stress.fixture");
    return buildStressTestingFixture({
      portfolioId: params.portfolioId,
      presetId: params.presetId,
      scenario: params.scenario,
    });
  }

  return {
    status: "not_integrated",
    moduleCode: "F3",
    moduleName: "Escenarios de estrés",
    backendDependency: "B4 · pendiente de API",
    message:
      "La comparación de escenarios Monte Carlo Base vs Estrés se habilitará cuando el backend publique la entrega B4 (RF-46).",
  };
}

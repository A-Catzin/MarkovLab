import "server-only";
import { isLocalFixturesEnabled, type AdapterResult, type ViewScenario } from "../runtime";
import type { OptimizationData, OptimizationObjective } from "../types";

export async function loadOptimizationView(params: {
  actorId: string;
  objective?: OptimizationObjective;
  maxVolatilityCap?: number | null;
  scenario?: ViewScenario;
}): Promise<AdapterResult<OptimizationData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildOptimizationFixture } = await import("../fixtures/optimization.fixture");
    return buildOptimizationFixture({
      objective: params.objective,
      maxVolatilityCap: params.maxVolatilityCap,
      scenario: params.scenario,
    });
  }

  return {
    status: "not_integrated",
    moduleCode: "F4",
    moduleName: "Optimización de carteras",
    backendDependency: "B5 · pendiente de API",
    message:
      "La optimización cuadrática (mínima varianza y máximo Sharpe) con límites por activo se activará cuando el backend publique la entrega B5.",
  };
}

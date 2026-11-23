import "server-only";
import { isLocalFixturesEnabled, type AdapterResult, type ViewScenario } from "../runtime";
import type { BacktestingData } from "../types";

export async function loadBacktestingView(params: {
  actorId: string;
  runId?: string;
  scenario?: ViewScenario;
}): Promise<AdapterResult<BacktestingData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildBacktestingFixture } = await import("../fixtures/backtesting.fixture");
    return buildBacktestingFixture({
      runId: params.runId,
      scenario: params.scenario,
    });
  }

  return {
    status: "not_integrated",
    moduleCode: "F6",
    moduleName: "Backtesting de estrategias",
    backendDependency: "B7 · pendiente de API",
    message:
      "La evaluación histórica fuera de muestra, comparación con benchmark y guardado de corridas se habilitarán cuando el backend publique la entrega B7.",
  };
}

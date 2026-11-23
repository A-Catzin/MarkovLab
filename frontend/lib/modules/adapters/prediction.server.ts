import "server-only";
import { isLocalFixturesEnabled, type AdapterResult, type ViewScenario } from "../runtime";
import type { PredictionData, PredictionMetricKind } from "../types";

export async function loadPredictionView(params: {
  actorId: string;
  symbol?: string;
  metric?: PredictionMetricKind;
  horizonDays?: 21 | 63 | 126;
  withObserved?: boolean;
  scenario?: ViewScenario;
}): Promise<AdapterResult<PredictionData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildPredictionFixture } = await import("../fixtures/prediction.fixture");
    return buildPredictionFixture(params);
  }

  return {
    status: "not_integrated",
    moduleCode: "F5",
    moduleName: "Predicción de activos",
    backendDependency: "B6 · pendiente de API",
    message:
      "La generación y persistencia de pronósticos base con bandas de incertidumbre y contraste observado se habilitará cuando el backend publique la entrega B6.",
  };
}

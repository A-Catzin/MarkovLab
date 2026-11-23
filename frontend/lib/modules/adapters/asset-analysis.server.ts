import "server-only";
import { isLocalFixturesEnabled, type AdapterResult, type ViewScenario } from "../runtime";
import type { AssetAnalysisData, PeriodPreset, ReturnKind } from "../types";

export async function loadAssetAnalysisView(params: {
  actorId: string;
  symbols?: string[];
  period?: PeriodPreset;
  from?: string;
  to?: string;
  returnKind?: ReturnKind;
  scenario?: ViewScenario;
}): Promise<AdapterResult<AssetAnalysisData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildAssetAnalysisFixture } = await import("../fixtures/asset-analysis.fixture");
    return buildAssetAnalysisFixture(params);
  }

  return {
    status: "not_integrated",
    moduleCode: "F1",
    moduleName: "Análisis de activos",
    backendDependency: "B2 · pendiente de API",
    message:
      "La consulta de rendimientos históricos, volatilidad y matriz de correlación se conectará cuando el backend publique los endpoints de B2.",
  };
}

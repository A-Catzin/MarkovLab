import "server-only";
import { isLocalFixturesEnabled, type AdapterResult, type ViewScenario } from "../runtime";
import type { PortfolioEditData } from "../types";

export async function loadPortfolioEditView(params: {
  actorId: string;
  portfolioId: string;
  scenario?: ViewScenario;
}): Promise<AdapterResult<PortfolioEditData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildPortfolioVersionsFixture } = await import("../fixtures/portfolio-versions.fixture");
    return buildPortfolioVersionsFixture({
      portfolioId: params.portfolioId,
      scenario: params.scenario,
    });
  }

  return {
    status: "not_integrated",
    moduleCode: "F2",
    moduleName: "Edición, versiones y duplicación de carteras",
    backendDependency: "B3 · pendiente de API",
    message:
      "La edición de carteras, historial de versiones y duplicación sin alterar el original se habilitarán cuando el backend publique la entrega B3.",
  };
}

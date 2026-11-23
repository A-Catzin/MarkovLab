import "server-only";
import { isLocalFixturesEnabled, MODULE_REGISTRY, type AdapterResult, type ViewScenario } from "../runtime";
import type { DashboardModuleSummary, DashboardOverviewData, ReportsData } from "../types";

export async function loadDashboardOverview(params: {
  actorId: string;
  userName?: string | null;
  scenario?: ViewScenario;
}): Promise<AdapterResult<DashboardOverviewData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildDashboardFixture } = await import("../fixtures/reports.fixture");
    return buildDashboardFixture({
      userName: params.userName,
      scenario: params.scenario,
    });
  }

  const [{ backendFetch }, { getPortfolios }] = await Promise.all([
    import("@/lib/backend"),
    import("@/lib/portfolios"),
  ]);

  const [portfoliosRes, watchlistRes] = await Promise.allSettled([
    getPortfolios(params.actorId),
    backendFetch<{ assets: unknown[] }>("/api/internal/watchlist", { actorId: params.actorId }),
  ]);

  const portfolioCount = portfoliosRes.status === "fulfilled" ? portfoliosRes.value.length : 0;
  const watchlistCount = watchlistRes.status === "fulfilled" ? watchlistRes.value.assets.length : 0;

  const productionModules: DashboardModuleSummary[] = [
    {
      code: "F2",
      name: "Simulador de riesgo",
      srsRefs: "RF-41 a RF-45",
      href: "/app/simulador",
      deliveryState: "publicado",
      backendStatusLabel: "Disponible",
      description: "Reparte tu capital entre activos de ejemplo y explora 10,000 trayectorias Monte Carlo reproducibles.",
      available: true,
    },
    {
      code: "F2",
      name: "Mis carteras",
      srsRefs: "RF-27 a RF-33",
      href: "/app/carteras",
      deliveryState: "publicado",
      backendStatusLabel: "Disponible",
      description: "Crea carteras multiactivo, consulta su historial valuado en su moneda y ejecuta simulaciones guardadas.",
      available: true,
    },
    {
      code: "F2",
      name: "Seguimiento de mercado",
      srsRefs: "RF-08 a RF-13",
      href: "/app/mercado",
      deliveryState: "publicado",
      backendStatusLabel: "Disponible",
      description: "Sigue activos del catálogo, inspecciona variaciones de cierre y consulta sus series históricas.",
      available: true,
    },
    ...MODULE_REGISTRY.filter((item) => item.code !== "F2").map((item) => {
      const available = item.deliveryState === "integrado con API" || item.deliveryState === "publicado";
      return {
        code: item.code,
        name: item.name,
        srsRefs: item.srsRefs,
        href: item.appHref,
        deliveryState: item.deliveryState,
        backendStatusLabel: available
          ? "Disponible"
          : `Pendiente de API (${item.backendDependency.split("·")[0].trim()})`,
        description: item.summary,
        available,
      };
    }),
  ];

  return {
    status: "ok",
    data: {
      userName: params.userName ?? null,
      portfolioCount,
      watchlistCount,
      latestOriginSummary: "PostgreSQL del laboratorio (datos reales del usuario)",
      modules: productionModules,
      recentAnalyses: [],
    },
    provenance: {
      origin: "api",
      freshness: "fresh",
      isExample: false,
      calculatedAt: new Date().toISOString().slice(0, 10),
      assumptions: "Módulos F1–F5 integrados con API B1–B6; F6–F7 muestran estado honesto hasta completar B7–B8",
    },
  };
}

export async function loadReportsView(params: {
  actorId: string;
  scenario?: ViewScenario;
}): Promise<AdapterResult<ReportsData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildReportsFixture } = await import("../fixtures/reports.fixture");
    return buildReportsFixture(params.scenario);
  }

  return {
    status: "not_integrated",
    moduleCode: "F7",
    moduleName: "Reportes y detalle matemático",
    backendDependency: "B8 · pendiente de API",
    message:
      "El resumen consolidado y la exportación CSV con alcance por usuario se habilitarán cuando el backend publique la entrega B8 (RF-54 a RF-58).",
  };
}

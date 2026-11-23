import "server-only";
import { isLocalFixturesEnabled, mapCommonBackendFailure, type AdapterResult, type ViewScenario } from "../runtime";
import type { PortfolioEditData } from "../types";

interface BackendPortfolioVersion {
  id: string;
  version_number: number;
  is_current: boolean;
  name: string;
  capital: number;
  currency: string;
  start_date: string;
  created_at: string | null;
  derived_from_id: string | null;
  derived_from_name: string | null;
  estimated_annual_return: number | null;
  estimated_annual_volatility: number | null;
  positions: { asset_id: number; symbol: string; name: string; weight: number }[];
}

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

  try {
    const [{ backendFetch, BackendError }, { getCatalogAssets, getPortfolio }] = await Promise.all([
      import("@/lib/backend"),
      import("@/lib/portfolios"),
    ]);

    try {
      const encodedId = encodeURIComponent(params.portfolioId);
      const [portfolio, versionsRes, rawCatalog] = await Promise.all([
        getPortfolio(params.actorId, params.portfolioId),
        backendFetch<{ versions: BackendPortfolioVersion[] }>(`/api/internal/portfolios/${encodedId}/versions`, {
          actorId: params.actorId,
        }),
        getCatalogAssets(params.actorId),
      ]);

      return {
        status: "ok",
        data: {
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          capital: portfolio.capital,
          currency: portfolio.currency.trim(),
          startDate: portfolio.start_date,
          catalog: rawCatalog.map((item) => ({
            id: item.id,
            label: `${item.symbol} · ${item.name} (${item.market})`,
            symbol: item.symbol,
            currency: item.currency.trim(),
          })),
          positions: portfolio.positions.map((pos) => ({
            assetId: pos.asset_id,
            symbol: pos.symbol,
            percent: Math.round(pos.weight * 10000) / 100,
          })),
          versions: versionsRes.versions.map((v) => ({
            id: v.id,
            versionNumber: v.version_number,
            name: v.name,
            createdAt: v.created_at ?? v.start_date,
            startDate: v.start_date,
            capital: v.capital,
            currency: v.currency.trim(),
            derivedFromId: v.derived_from_id,
            derivedFromName: v.derived_from_name,
            estimatedAnnualReturn: v.estimated_annual_return,
            estimatedAnnualVolatility: v.estimated_annual_volatility,
            isCurrent: v.is_current,
            positions: v.positions.map((pos) => ({
              assetId: pos.asset_id,
              symbol: pos.symbol,
              name: pos.name,
              weight: pos.weight,
            })),
          })),
          pendingBackend: false,
        },
        provenance: {
          origin: "api",
          freshness: "fresh",
          isExample: false,
          calculatedAt: portfolio.created_at?.slice(0, 10) ?? portfolio.start_date,
          assumptions:
            "Edición atómica con historial de versiones persistido; duplicar crea una cartera independiente sin alterar el original",
        },
      };
    } catch (error) {
      if (error instanceof BackendError && error.status === 404) {
        return {
          status: "empty",
          title: "Cartera no encontrada",
          message: "La cartera solicitada no existe o pertenece a otro usuario.",
          actionLabel: "Volver a Mis carteras",
          actionHref: "/app/carteras",
        };
      }
      throw error;
    }
  } catch (error) {
    const common = mapCommonBackendFailure<PortfolioEditData>(
      error,
      "Servicio de carteras no disponible",
      "No pudimos cargar la cartera ni su historial de versiones en este momento.",
    );
    if (common) return common;
    return {
      status: "unavailable",
      title: "Servicio de carteras no disponible",
      message: "Ocurrió un error inesperado al consultar la edición de la cartera.",
    };
  }
}
import "server-only";
import { isLocalFixturesEnabled, mapCommonBackendFailure, type AdapterResult, type ViewScenario } from "../runtime";
import type { AssetAnalysisData, PeriodPreset, ReturnKind } from "../types";
import { validateDateRange } from "../validators";

interface BackendAssetMetric {
  asset_id: number;
  symbol: string;
  name: string;
  currency: string;
  observations: number;
  effective_from: string;
  effective_to: string;
  simple_return: number | null;
  log_return: number | null;
  cumulative_return: number | null;
  mean_return_daily: number | null;
  volatility_daily: number | null;
  volatility_annualized: number | null;
  max_drawdown: number | null;
  peak_date: string | null;
  trough_date: string | null;
}

interface BackendAssetAnalysisResponse {
  selected_symbols: string[];
  period_preset: PeriodPreset;
  return_kind: ReturnKind;
  requested_from: string;
  requested_to: string;
  effective_from: string;
  effective_to: string;
  aligned_observations: number;
  annualization_factor: number;
  per_asset_metrics: BackendAssetMetric[];
  series_aligned: { symbol: string; points: [string, number][] }[];
  correlation_symbols: string[];
  correlation_matrix: (number | null)[][];
}

function selectDefaultSymbols(
  catalog: { symbol: string; price_rows: number }[],
): string[] {
  const counts = new Map<string, number>();
  for (const item of catalog) {
    counts.set(item.symbol, (counts.get(item.symbol) ?? 0) + 1);
  }
  const uniqueOnly = catalog.filter((item) => counts.get(item.symbol) === 1);
  const pool = uniqueOnly.length > 0 ? uniqueOnly : catalog;
  const rich = pool.filter((item) => item.price_rows >= 2);
  const picked = (rich.length > 0 ? rich : pool).slice(0, 4).map((item) => item.symbol);
  return [...new Set(picked)];
}

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

  const period: PeriodPreset = params.period ?? "1A";
  const returnKind: ReturnKind = params.returnKind ?? "simple";
  const from = params.from ?? "";
  const to = params.to ?? "";

  if (period === "custom") {
    const issues = validateDateRange(from, to);
    if (issues.length > 0) {
      return {
        status: "validation_error",
        title: "Rango de fechas inválido",
        message: "Corrige el intervalo personalizado antes de consultar el backend.",
        issues,
      };
    }
  }

  try {
    const [{ backendFetch, BackendError }, { getCatalogAssets }] = await Promise.all([
      import("@/lib/backend"),
      import("@/lib/portfolios"),
    ]);

    const rawCatalog = await getCatalogAssets(params.actorId);
    if (rawCatalog.length === 0) {
      return {
        status: "empty",
        title: "Catálogo sin activos",
        message: "Todavía no hay activos registrados en el catálogo para analizar.",
        actionLabel: "Ir a Seguimiento de mercado",
        actionHref: "/app/mercado",
      };
    }

    const catalog = rawCatalog.map((item) => ({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      currency: item.currency.trim(),
      availableObservations: item.price_rows,
    }));

    const requested = [...new Set((params.symbols ?? []).map((s) => s.trim().toUpperCase()).filter(Boolean))];
    const selectedSymbols = requested.length > 0 ? requested : selectDefaultSymbols(rawCatalog);

    const requestBody: {
      symbols: string[];
      period: PeriodPreset;
      return_kind: ReturnKind;
      from?: string;
      to?: string;
    } = {
      symbols: selectedSymbols,
      period,
      return_kind: returnKind,
    };
    if (period === "custom") {
      requestBody.from = from;
      requestBody.to = to;
    }

    try {
      const response = await backendFetch<BackendAssetAnalysisResponse>("/api/internal/analysis/assets", {
        method: "POST",
        actorId: params.actorId,
        body: requestBody,
      });

      return {
        status: "ok",
        data: {
          catalog,
          selectedSymbols: response.selected_symbols,
          periodPreset: response.period_preset,
          returnKind: response.return_kind,
          requestedFrom: response.requested_from,
          requestedTo: response.requested_to,
          effectiveFrom: response.effective_from,
          effectiveTo: response.effective_to,
          alignedObservations: response.aligned_observations,
          annualizationFactor: response.annualization_factor,
          metrics: response.per_asset_metrics.map((row) => ({
            assetId: row.asset_id,
            symbol: row.symbol,
            name: row.name,
            currency: row.currency.trim(),
            observations: row.observations,
            effectiveFrom: row.effective_from,
            effectiveTo: row.effective_to,
            simpleReturn: row.simple_return,
            logReturn: row.log_return,
            cumulativeReturn: row.cumulative_return,
            meanReturnDaily: row.mean_return_daily,
            volatilityDaily: row.volatility_daily,
            volatilityAnnualized: row.volatility_annualized,
            maxDrawdown: row.max_drawdown,
            peakDate: row.peak_date,
            troughDate: row.trough_date,
          })),
          correlationSymbols: response.correlation_symbols,
          correlationMatrix: response.correlation_matrix,
          series: response.series_aligned,
        },
        provenance: {
          origin: "api",
          freshness: "fresh",
          isExample: false,
          calculatedAt: new Date().toISOString().slice(0, 10),
          effectiveRange: {
            from: response.effective_from,
            to: response.effective_to,
            observations: response.aligned_observations,
          },
          assumptions: "Solo sesiones con cierre común sin interpolación; anualización √252 en moneda de cotización",
        },
      };
    } catch (error) {
      if (error instanceof BackendError) {
        if (error.status === 422 || error.code === "insufficient_data") {
          return {
            status: "insufficient_data",
            title: "Histórico común insuficiente para el período (RF-20)",
            message:
              "Los activos seleccionados tienen menos de dos sesiones de cierre comunes en la ventana consultada.",
            details: ["El motor requiere al menos 2 sesiones compartidas sin interpolar precios faltantes."],
            effectiveRange: {
              from: period === "custom" ? from : period,
              to: period === "custom" ? to : "ayer (UTC)",
              observations: Number(error.details?.observed_sessions ?? 0),
              required: Number(error.details?.required_sessions ?? 2),
            },
          };
        }
        if (error.status === 400) {
          return {
            status: "validation_error",
            title: "Parámetros de análisis rechazados",
            message: error.message,
            issues: [{ field: "asset-selector", message: error.message }],
          };
        }
      }
      throw error;
    }
  } catch (error) {
    const common = mapCommonBackendFailure<AssetAnalysisData>(
      error,
      "Motor de análisis no disponible",
      "No fue posible conectar con el backend de análisis histórico.",
    );
    if (common) return common;
    return {
      status: "unavailable",
      title: "Motor de análisis no disponible",
      message: "Ocurrió un error inesperado al consultar el análisis de activos.",
    };
  }
}
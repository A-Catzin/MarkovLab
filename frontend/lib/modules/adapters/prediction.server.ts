import "server-only";
import {
  isLocalFixturesEnabled,
  mapCommonBackendFailure,
  type AdapterResult,
  type ProvenanceInfo,
  type ValidationIssue,
  type ViewScenario,
} from "../runtime";
import type {
  PredictionAssetOption,
  PredictionData,
  PredictionMetricKind,
} from "../types";
import { isValidIsoDate } from "../validators";

interface BackendPredictionSeriesPoint {
  date: string;
  phase: "historical" | "forecast";
  date_estimated?: boolean;
  historical_value: number | null;
  forecast_point: number | null;
  lower_bound: number | null;
  upper_bound: number | null;
  observed_after_value: number | null;
}

interface BackendPredictionEvaluation {
  observed_points: number;
  mae: number;
  rmse: number;
  interval_coverage: number;
}

interface BackendPredictionResponse {
  id: string;
  asset_id: number;
  symbol: string;
  market: string;
  calculated_at: string;
  as_of: string;
  metric: PredictionMetricKind;
  horizon_days: 21 | 63 | 126;
  model: string;
  parameters: {
    confidence: number;
    max_training_closes: number;
    volatility_sessions: number;
    sessions_per_year: number;
  };
  training_window: {
    from: string;
    to: string;
    observations: number;
  };
  point: number;
  lower_bound: number;
  upper_bound: number;
  limitations: string[];
  series: BackendPredictionSeriesPoint[];
  evaluation: BackendPredictionEvaluation | null;
}

export type PredictionExecuteResult =
  | { ok: true; prediction: PredictionData; provenance: ProvenanceInfo }
  | {
      ok: false;
      kind: "validation" | "insufficient_data" | "unavailable" | "forbidden" | "not_found";
      title: string;
      message: string;
      issues?: ValidationIssue[];
    };

function mapPredictionToData(
  raw: BackendPredictionResponse,
  assets: PredictionAssetOption[],
): { prediction: PredictionData; provenance: ProvenanceInfo } {
  const confidencePct = Math.round(raw.parameters.confidence * 100);
  const evaluation = raw.evaluation
    ? {
        observedPoints: raw.evaluation.observed_points,
        mae: raw.evaluation.mae,
        rmse: raw.evaluation.rmse,
        intervalCoverage: raw.evaluation.interval_coverage,
      }
    : null;

  const prediction: PredictionData = {
    assets,
    selectedAssetId: raw.asset_id,
    selectedSymbol: raw.symbol,
    metric: raw.metric,
    horizonDays: raw.horizon_days,
    confidenceLabel: `IC ${confidencePct} %`,
    modelName: raw.model,
    modelParameters: `Ventana máx. ${raw.parameters.max_training_closes} cierres · vol. ${raw.parameters.volatility_sessions} ses. · ${raw.parameters.sessions_per_year} ses./año`,
    trainingWindow: {
      from: raw.training_window.from,
      to: raw.training_window.to,
      observations: raw.training_window.observations,
    },
    calculatedAt: raw.calculated_at,
    asOf: raw.as_of,
    activePredictionId: raw.id,
    point: raw.point,
    lowerBound: raw.lower_bound,
    upperBound: raw.upper_bound,
    predictionLoadError: null,
    hasPostObservations: evaluation !== null && evaluation.observedPoints > 0,
    evaluation,
    limitations: raw.limitations,
    series: raw.series.map((pt) => ({
      date: pt.date,
      phase: pt.phase,
      dateEstimated: Boolean(pt.date_estimated),
      historicalValue: pt.historical_value,
      forecastPoint: pt.forecast_point,
      lowerBound: pt.lower_bound,
      upperBound: pt.upper_bound,
      observedAfterValue: pt.observed_after_value,
    })),
  };

  const provenance: ProvenanceInfo = {
    origin: "api",
    freshness: "fresh",
    isExample: false,
    calculatedAt: raw.calculated_at.slice(0, 10),
    effectiveRange: {
      from: raw.training_window.from,
      to: raw.training_window.to,
      observations: raw.training_window.observations,
    },
    assumptions: `Corte ${raw.as_of} · ${raw.model === "empirical_stationary_v1" ? "Cuantiles históricos estacionarios" : raw.model} · solo referencia estadística`,
  };

  return { prediction, provenance };
}

function mapPredictionBackendError(error: unknown, notFoundMessage: string): PredictionExecuteResult {
  const errObj = error as { status?: number; code?: string; message?: string };
  if (errObj && typeof errObj.status === "number") {
    if (errObj.status === 422 && errObj.code === "insufficient_data") {
      return {
        ok: false,
        kind: "insufficient_data",
        title: "Histórico insuficiente para pronosticar",
        message:
          "El activo necesita al menos 60 cierres registrados hasta la fecha de corte seleccionada.",
      };
    }
    if (errObj.status === 400) {
      return {
        ok: false,
        kind: "validation",
        title: "Parámetros de pronóstico rechazados",
        message: errObj.message || "Revisa el activo, horizonte o fecha de corte enviada.",
        issues: [{ field: "pred-as-of", message: errObj.message || "Parámetros inválidos." }],
      };
    }
    if (errObj.status === 404) {
      return {
        ok: false,
        kind: "not_found",
        title: "Recurso no encontrado",
        message: notFoundMessage,
      };
    }
    if (errObj.status === 401 || errObj.status === 403) {
      return {
        ok: false,
        kind: "forbidden",
        title: "Acceso no autorizado",
        message: "Tu sesión actual no tiene permisos para generar o consultar este pronóstico.",
      };
    }
  }

  const common = mapCommonBackendFailure(
    error,
    "Servicio de predicción temporalmente no disponible",
    "No fue posible conectar con el motor de predicción en Julia.",
  );
  if (common && common.status === "forbidden") {
    return { ok: false, kind: "forbidden", title: common.title, message: common.message };
  }
  return {
    ok: false,
    kind: "unavailable",
    title: "Servicio de predicción temporalmente no disponible",
    message: "No fue posible conectar con el motor de predicción en Julia.",
  };
}

export async function executeAssetPrediction(params: {
  actorId: string;
  assetId: number;
  metric: PredictionMetricKind;
  horizonDays: 21 | 63 | 126;
  asOf?: string | null;
}): Promise<PredictionExecuteResult> {
  const issues: ValidationIssue[] = [];
  if (!Number.isInteger(params.assetId) || params.assetId <= 0) {
    issues.push({ field: "pred-asset", message: "Selecciona un activo válido del catálogo." });
  }
  if (params.metric !== "return" && params.metric !== "volatility") {
    issues.push({ field: "pred-controls-title", message: "La métrica debe ser rendimiento o volatilidad." });
  }
  if (params.horizonDays !== 21 && params.horizonDays !== 63 && params.horizonDays !== 126) {
    issues.push({ field: "pred-horizon", message: "El horizonte permitido es 21, 63 o 126 sesiones." });
  }

  const trimmedAsOf = params.asOf?.trim() ?? "";
  if (trimmedAsOf && !isValidIsoDate(trimmedAsOf)) {
    issues.push({ field: "pred-as-of", message: "Indica una fecha de corte válida (AAAA-MM-DD)." });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      kind: "validation",
      title: "Revisa los parámetros del pronóstico",
      message: "Corrige los campos señalados antes de ejecutar el modelo.",
      issues,
    };
  }

  try {
    const { backendFetch } = await import("@/lib/backend");
    const body: { metric: PredictionMetricKind; horizon_days: 21 | 63 | 126; as_of?: string } = {
      metric: params.metric,
      horizon_days: params.horizonDays,
    };
    if (trimmedAsOf) {
      body.as_of = trimmedAsOf;
    }

    const saved = await backendFetch<BackendPredictionResponse>(
      `/api/internal/assets/${encodeURIComponent(String(params.assetId))}/predictions`,
      {
        method: "POST",
        actorId: params.actorId,
        body,
      },
    );

    const mapped = mapPredictionToData(saved, [
      { id: saved.asset_id, symbol: saved.symbol, name: saved.symbol, market: saved.market },
    ]);
    return { ok: true, prediction: mapped.prediction, provenance: mapped.provenance };
  } catch (error) {
    return mapPredictionBackendError(error, "El activo seleccionado no existe en el catálogo.");
  }
}

export async function refreshAssetPrediction(params: {
  actorId: string;
  predictionId: string;
}): Promise<PredictionExecuteResult> {
  const cleanId = params.predictionId.trim();
  if (!cleanId) {
    return {
      ok: false,
      kind: "validation",
      title: "Pronóstico no especificado",
      message: "Genera o selecciona un pronóstico guardado antes de actualizar su contraste.",
    };
  }

  try {
    const { backendFetch } = await import("@/lib/backend");
    const loaded = await backendFetch<BackendPredictionResponse>(
      `/api/internal/predictions/${encodeURIComponent(cleanId)}`,
      { actorId: params.actorId },
    );
    const mapped = mapPredictionToData(loaded, [
      { id: loaded.asset_id, symbol: loaded.symbol, name: loaded.symbol, market: loaded.market },
    ]);
    return { ok: true, prediction: mapped.prediction, provenance: mapped.provenance };
  } catch (error) {
    return mapPredictionBackendError(
      error,
      "No se encontró el pronóstico solicitado o pertenece a otro usuario.",
    );
  }
}

export async function loadPredictionView(params: {
  actorId: string;
  symbol?: string;
  assetId?: number;
  metric?: PredictionMetricKind;
  horizonDays?: 21 | 63 | 126;
  withObserved?: boolean;
  predictionId?: string;
  scenario?: ViewScenario;
}): Promise<AdapterResult<PredictionData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildPredictionFixture } = await import("../fixtures/prediction.fixture");
    return buildPredictionFixture(params);
  }

  const metric: PredictionMetricKind = params.metric === "volatility" ? "volatility" : "return";
  const horizonDays: 21 | 63 | 126 =
    params.horizonDays === 21 || params.horizonDays === 126 ? params.horizonDays : 63;

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
        message: "Todavía no hay activos registrados en el catálogo para generar pronósticos.",
        actionLabel: "Ir a Seguimiento de mercado",
        actionHref: "/app/mercado",
      };
    }

    const assets: PredictionAssetOption[] = rawCatalog.map((item) => ({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      market: item.market,
      lastDate: item.last_date,
      priceRows: item.price_rows,
    }));

    const selectedAsset =
      (typeof params.assetId === "number"
        ? assets.find((item) => item.id === params.assetId)
        : undefined) ??
      (params.symbol
        ? assets.find((item) => item.symbol.toUpperCase() === params.symbol!.toUpperCase())
        : undefined) ??
      assets.find((item) => (item.priceRows ?? 0) >= 60) ??
      assets[0];

    let predictionLoadError: string | null = null;
    const requestedPredictionId = params.predictionId?.trim() ?? "";

    if (requestedPredictionId) {
      try {
        const loaded = await backendFetch<BackendPredictionResponse>(
          `/api/internal/predictions/${encodeURIComponent(requestedPredictionId)}`,
          { actorId: params.actorId },
        );
        const mapped = mapPredictionToData(loaded, assets);
        return {
          status: "ok",
          data: mapped.prediction,
          provenance: mapped.provenance,
        };
      } catch (error) {
        if (error instanceof BackendError && (error.status === 404 || error.status === 400)) {
          predictionLoadError =
            "No se encontró el pronóstico guardado solicitado o pertenece a otro usuario.";
        } else {
          throw error;
        }
      }
    }

    return {
      status: "ok",
      data: {
        assets,
        selectedAssetId: selectedAsset.id,
        selectedSymbol: selectedAsset.symbol,
        metric,
        horizonDays,
        confidenceLabel: "IC 90 %",
        modelName: "empirical_stationary_v1",
        modelParameters: "Ventana máx. 252 cierres · vol. 21 ses. · 252 ses./año",
        trainingWindow: { from: "—", to: "—", observations: 0 },
        calculatedAt: new Date().toISOString().slice(0, 10),
        asOf: selectedAsset.lastDate ?? null,
        activePredictionId: null,
        point: null,
        lowerBound: null,
        upperBound: null,
        predictionLoadError,
        hasPostObservations: false,
        evaluation: null,
        limitations: [],
        series: [],
      },
      provenance: {
        origin: "api",
        freshness: "fresh",
        isExample: false,
        calculatedAt: new Date().toISOString().slice(0, 10),
        assumptions:
          "Sin pronóstico ejecutado en esta consulta · elige un activo, horizonte y fecha de corte opcional para generar uno guardado",
      },
    };
  } catch (error) {
    const common = mapCommonBackendFailure<PredictionData>(
      error,
      "Servicio de predicción temporalmente no disponible",
      "No fue posible conectar con el motor de predicción en Julia.",
    );
    if (common) return common;
    return {
      status: "unavailable",
      title: "Servicio de predicción temporalmente no disponible",
      message: "Ocurrió un error inesperado al cargar el módulo de predicción.",
    };
  }
}

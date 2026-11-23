import "server-only";
import { isLocalFixturesEnabled, mapCommonBackendFailure, type AdapterResult, type ViewScenario } from "../runtime";
import type { StressRunSummary, StressShockInput, StressTestingData } from "../types";
import { validateStressParams } from "../validators";

const DEFAULT_STRESS_PRESETS: readonly StressShockInput[] = [
  {
    presetId: "caida-mercado",
    label: "Caída general de mercado",
    description: "Choque adverso de retorno (-18 pp), volatilidad al 1.55× y aumento moderado de correlaciones.",
    returnShift: -0.18,
    volatilityMultiplier: 1.55,
    correlationShift: 0.25,
  },
  {
    presetId: "alta-volatilidad",
    label: "Régimen de alta volatilidad",
    description: "Retorno esperado neutralizado (-4 pp) con volatilidad multiplicada por 2.00×.",
    returnShift: -0.04,
    volatilityMultiplier: 2.0,
    correlationShift: 0.15,
  },
  {
    presetId: "correlacion-extrema",
    label: "Correlación extrema en crisis",
    description: "Pérdida de diversificación con desplazamiento de correlaciones (+0.45) y caída de retorno (-12 pp).",
    returnShift: -0.12,
    volatilityMultiplier: 1.4,
    correlationShift: 0.45,
  },
];

interface BackendStressSummary {
  horizon_days: number;
  confidence: number;
  seed: number;
  simulations: number;
  expected_final_value: number;
  median_final_value: number;
  p5_final_value: number;
  p95_final_value: number;
  var_fraction: number;
  var_amount: number;
  cvar_fraction: number;
  cvar_amount: number;
}

interface BackendStressResponse {
  portfolio_id: string;
  portfolio_name: string;
  capital: number;
  currency: string;
  model: string;
  window: { from: string; to: string };
  observations: number;
  lookback_years: number;
  shock: {
    return_shift: number;
    volatility_multiplier: number;
    correlation_shift: number;
  };
  baseline: BackendStressSummary;
  stressed: BackendStressSummary;
}

function mapStressSummary(raw: BackendStressSummary): StressRunSummary {
  return {
    horizonDays: raw.horizon_days,
    confidence: raw.confidence,
    seed: raw.seed,
    simulations: raw.simulations,
    expectedFinalValue: raw.expected_final_value,
    medianFinalValue: raw.median_final_value,
    p5FinalValue: raw.p5_final_value,
    p95FinalValue: raw.p95_final_value,
    varFraction: raw.var_fraction,
    varAmount: raw.var_amount,
    cvarFraction: raw.cvar_fraction,
    cvarAmount: raw.cvar_amount,
  };
}

export async function loadStressTestingView(params: {
  actorId: string;
  portfolioId: string;
  presetId?: string;
  returnShift?: number;
  volatilityMultiplier?: number;
  correlationShift?: number;
  horizonDays?: number;
  confidence?: number;
  seed?: number;
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

  const hasCustom =
    params.presetId === "personalizado" ||
    params.returnShift !== undefined ||
    params.volatilityMultiplier !== undefined ||
    params.correlationShift !== undefined;

  const customReturn = params.returnShift ?? -0.18;
  const customVol = params.volatilityMultiplier ?? 1.55;
  const customCorr = params.correlationShift ?? 0.25;

  if (hasCustom) {
    const issues = validateStressParams({
      returnShift: customReturn,
      volatilityMultiplier: customVol,
      correlationShift: customCorr,
    });
    if (issues.length > 0) {
      return {
        status: "validation_error",
        title: "Parámetros de estrés fuera de rango válido",
        message: "Los choques aplicados deben conservar volatilidades positivas y correlaciones válidas.",
        issues,
      };
    }
  }

  const presets: StressShockInput[] = hasCustom
    ? [
        ...DEFAULT_STRESS_PRESETS,
        {
          presetId: "personalizado",
          label: "Choque personalizado",
          description: `Choque personalizado: retorno ${(customReturn * 100).toFixed(1)} pp, volatilidad ${customVol.toFixed(2)}× y correlación ${customCorr >= 0 ? "+" : ""}${customCorr.toFixed(2)}.`,
          returnShift: customReturn,
          volatilityMultiplier: customVol,
          correlationShift: customCorr,
        },
      ]
    : [...DEFAULT_STRESS_PRESETS];

  const activePresetId = hasCustom
    ? "personalizado"
    : presets.some((p) => p.presetId === params.presetId)
      ? (params.presetId as string)
      : presets[0].presetId;

  const horizon = params.horizonDays ?? 21;
  const confidence = params.confidence ?? 0.95;
  const seed = params.seed ?? 42;
  const encodedId = encodeURIComponent(params.portfolioId);

  try {
    const { backendFetch, BackendError } = await import("@/lib/backend");

    try {
      const responses = await Promise.all(
        presets.map((preset) =>
          backendFetch<BackendStressResponse>(`/api/internal/portfolios/${encodedId}/stress`, {
            method: "POST",
            actorId: params.actorId,
            body: {
              horizon,
              simulations: 10000,
              confidence,
              seed,
              return_shift: preset.returnShift,
              volatility_multiplier: preset.volatilityMultiplier,
              correlation_shift: preset.correlationShift,
            },
          }),
        ),
      );

      const first = responses[0];
      const stressedByPreset: Record<string, StressRunSummary> = {};
      presets.forEach((preset, idx) => {
        stressedByPreset[preset.presetId] = mapStressSummary(responses[idx].stressed);
      });

      return {
        status: "ok",
        data: {
          portfolioId: first.portfolio_id,
          portfolioName: first.portfolio_name,
          capital: first.capital,
          currency: first.currency.trim(),
          horizonDays: first.baseline.horizon_days,
          confidence: first.baseline.confidence,
          seed: first.baseline.seed,
          presets,
          activePresetId,
          baseline: mapStressSummary(first.baseline),
          stressedByPreset,
        },
        provenance: {
          origin: "api",
          freshness: "fresh",
          isExample: false,
          calculatedAt: new Date().toISOString().slice(0, 10),
          effectiveRange: {
            from: first.window.from,
            to: first.window.to,
            observations: first.observations,
          },
          assumptions: `Modelo ${first.model} (${first.lookback_years} años); mismo horizonte (${first.baseline.horizon_days} d.), confianza (${Math.round(first.baseline.confidence * 100)} %) y semilla (${first.baseline.seed}) en Base y Estrés`,
        },
      };
    } catch (error) {
      if (error instanceof BackendError) {
        if (error.status === 404) {
          return {
            status: "empty",
            title: "Cartera no encontrada",
            message: "La cartera solicitada no existe o pertenece a otro usuario.",
            actionLabel: "Volver a Mis carteras",
            actionHref: "/app/carteras",
          };
        }
        if (error.status === 422 && error.code === "missing_exchange_rate") {
          return {
            status: "unavailable",
            title: "Falta tipo de cambio para valuar la cartera",
            message:
              "Esta cartera contiene activos en otra moneda y falta el tipo de cambio necesario para convertir sus precios.",
          };
        }
        if (error.status === 422 || error.code === "insufficient_data") {
          return {
            status: "insufficient_data",
            title: "Histórico insuficiente para calibrar el estrés",
            message:
              "Los activos de esta cartera no cuentan con el mínimo de 60 cierres comunes en la ventana histórica.",
            details: ["Se requieren al menos 60 sesiones alineadas compartidas para calibrar Base vs Estrés."],
          };
        }
        if (error.status === 400) {
          return {
            status: "validation_error",
            title: "Parámetros de estrés rechazados",
            message: error.message,
            issues: [{ field: "stress-return-shift", message: error.message }],
          };
        }
      }
      throw error;
    }
  } catch (error) {
    const common = mapCommonBackendFailure<StressTestingData>(
      error,
      "Simulador de estrés no disponible",
      "No fue posible comunicarse con el motor de simulación en este momento.",
    );
    if (common) return common;
    return {
      status: "unavailable",
      title: "Simulador de estrés no disponible",
      message: "Ocurrió un error inesperado al ejecutar la comparación de estrés.",
    };
  }
}
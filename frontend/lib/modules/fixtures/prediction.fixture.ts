import type { AdapterResult, ViewScenario } from "../runtime";
import type { PredictionData, PredictionMetricKind, PredictionSeriesPoint } from "../types";

const ASSETS = [
  { id: 1, symbol: "AAPL", name: "Apple Inc." },
  { id: 2, symbol: "MSFT", name: "Microsoft Corp." },
  { id: 4, symbol: "WALMEX.MX", name: "Wal-Mart de México" },
];

const LIMITATIONS = [
  "El modelo base usa ponderación exponencial EWMA y supone estacionariedad local de corto plazo; no anticipa choques corporativos ni cambios abruptos de tasa.",
  "Los intervalos de incertidumbre (80 %) expresan dispersión histórica estimada, nunca una garantía de rendimiento ni una certeza estadística.",
  "Una vista previa local muestra series sintéticas de referencia para inspeccionar el flujo; no representa una proyección real de mercado.",
];

export function buildPredictionFixture(params: {
  symbol?: string;
  metric?: PredictionMetricKind;
  horizonDays?: 21 | 63 | 126;
  withObserved?: boolean;
  scenario?: ViewScenario;
}): AdapterResult<PredictionData> {
  const scenario = params.scenario ?? "normal";
  const selectedSymbol = ASSETS.some((a) => a.symbol === params.symbol) ? (params.symbol as string) : "AAPL";
  const metric: PredictionMetricKind = params.metric === "volatility" ? "volatility" : "return";
  const horizonDays: 21 | 63 | 126 =
    params.horizonDays === 21 || params.horizonDays === 126 ? params.horizonDays : 63;
  const withObserved = params.withObserved ?? true;

  if (scenario === "vacio") {
    return {
      status: "empty",
      title: "Sin pronósticos registrados para este activo",
      message: "Ejecuta o selecciona una ventana histórica válida para generar un pronóstico de referencia con su banda de incertidumbre.",
      actionLabel: "Ir al Análisis de activos",
      actionHref: "/app/mercado/analisis",
    };
  }
  if (scenario === "pocos-datos") {
    return {
      status: "insufficient_data",
      title: "Serie insuficiente para calibrar el modelo base",
      message: "El modelo EWMA/ARIMA de referencia requiere al menos 60 observaciones en la ventana de entrenamiento.",
      details: ["Cobertura actual: 18 sesiones válidas antes de la fecha de cálculo."],
      effectiveRange: { from: "2026-10-05", to: "2026-10-30", observations: 18, required: 60 },
    };
  }
  if (scenario === "validacion") {
    return {
      status: "validation_error",
      title: "Parámetros de pronóstico inválidos",
      message: "El horizonte permitido debe estar entre 21, 63 o 126 días hábiles y no puede solapar el entrenamiento.",
      issues: [{ field: "pred-horizon", message: "Selecciona un horizonte soportado (21, 63 o 126 días)." }],
    };
  }
  if (scenario === "no-disponible") {
    return {
      status: "unavailable",
      title: "Servicio de predicción no disponible",
      message: "No fue posible consultar los pronósticos persistidos en este momento.",
      lastUpdated: "2026-10-30 16:00",
    };
  }
  if (scenario === "denegado") {
    return {
      status: "forbidden",
      title: "Sin permiso sobre esta configuración de pronóstico",
      message: "Inicia sesión para consultar y registrar pronósticos reproducibles.",
    };
  }

  const bias = selectedSymbol === "AAPL" ? 1 : selectedSymbol === "MSFT" ? 0.85 : 0.65;
  const isVol = metric === "volatility";
  const trainingTo = withObserved ? "2026-07-31" : "2026-10-30";

  const historicalDates = withObserved
    ? ["2026-05-04", "2026-05-29", "2026-06-30", "2026-07-31"]
    : ["2026-07-31", "2026-08-31", "2026-09-30", "2026-10-30"];

  const forecastDates = withObserved
    ? ["2026-08-31", "2026-09-30", "2026-10-30"]
    : ["2026-11-30", "2026-12-31", "2027-01-29"];

  const histBase = isVol ? [0.18, 0.21, 0.19, 0.22] : [0.021, 0.044, 0.068, 0.089];
  const pointBase = isVol ? [0.225, 0.232, 0.238] : [0.104, 0.119, 0.134];
  const bandHalf = isVol ? [0.025, 0.036, 0.048] : [0.028, 0.044, 0.061];
  const obsValues = isVol ? [0.218, 0.246, 0.231] : [0.098, 0.128, 0.116];

  const scaleH = horizonDays === 21 ? 0.6 : horizonDays === 126 ? 1.35 : 1;

  const series: PredictionSeriesPoint[] = [
    ...historicalDates.map((date, idx) => ({
      date,
      phase: "historical" as const,
      historicalValue: Number((histBase[idx] * bias).toFixed(4)),
      forecastPoint: null,
      lowerBound: null,
      upperBound: null,
      observedAfterValue: null,
    })),
    ...forecastDates.map((date, idx) => {
      const point = Number((pointBase[idx] * bias * (isVol ? 1 : scaleH)).toFixed(4));
      const delta = Number((bandHalf[idx] * (isVol ? 1 : Math.sqrt(scaleH))).toFixed(4));
      return {
        date,
        phase: "forecast" as const,
        historicalValue: null,
        forecastPoint: point,
        lowerBound: Number((point - delta).toFixed(4)),
        upperBound: Number((point + delta).toFixed(4)),
        observedAfterValue: withObserved ? Number((obsValues[idx] * bias * (isVol ? 1 : scaleH)).toFixed(4)) : null,
      };
    }),
  ];

  return {
    status: "ok",
    data: {
      assets: ASSETS,
      selectedSymbol,
      metric,
      horizonDays,
      confidenceLabel: "Intervalo al 80 %",
      modelName: isVol ? "ewma-volatility-baseline-v1" : "ewma-drift-baseline-v1",
      modelParameters: isVol ? "lambda=0.94, anualizacion=252" : "lambda=0.92, ventana=126 sesiones",
      trainingWindow: {
        from: withObserved ? "2026-02-02" : "2026-05-04",
        to: trainingTo,
        observations: 126,
      },
      calculatedAt: withObserved ? "2026-07-31 16:30" : "2026-10-30 16:30",
      hasPostObservations: withObserved,
      evaluation: withObserved
        ? {
            observedPoints: forecastDates.length,
            mae: isVol ? 0.009 : 0.011,
            rmse: isVol ? 0.011 : 0.014,
            intervalCoverage: 1.0,
          }
        : null,
      limitations: LIMITATIONS,
      series,
    },
    provenance: {
      origin: "fixtures",
      freshness: "example",
      isExample: true,
      calculatedAt: withObserved ? "2026-07-31 16:30" : "2026-10-30 16:30",
      effectiveRange: {
        from: withObserved ? "2026-02-02" : "2026-05-04",
        to: trainingTo,
        observations: 126,
      },
      assumptions: "Pronóstico estadístico de referencia con fines educativos; nunca certeza",
    },
  };
}

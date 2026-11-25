import type { AdapterResult } from "../runtime";
import type {
  AssetAnalysisData,
  AssetAnalysisMetricRow,
  NormalizedAssetSeries,
  PeriodPreset,
  ReturnKind,
} from "../types";
import type { ViewScenario } from "../runtime";
import { validateDateRange } from "../validators";

const ASSET_CATALOG = [
  { id: 1, symbol: "AAPL", name: "Apple Inc.", currency: "USD", availableObservations: 756 },
  { id: 2, symbol: "MSFT", name: "Microsoft Corp.", currency: "USD", availableObservations: 756 },
  { id: 3, symbol: "JPM", name: "JPMorgan Chase & Co.", currency: "USD", availableObservations: 756 },
  { id: 4, symbol: "WALMEX.MX", name: "Wal-Mart de México", currency: "MXN", availableObservations: 756 },
  { id: 5, symbol: "XOM", name: "Exxon Mobil Corp.", currency: "USD", availableObservations: 756 },
  { id: 6, symbol: "NU", name: "Nu Holdings (muestra corta)", currency: "USD", availableObservations: 12 },
] as const;

const PERIOD_SPECS: Record<Exclude<PeriodPreset, "custom">, { from: string; to: string; observations: number; scale: number }> = {
  "3M": { from: "2026-08-03", to: "2026-10-30", observations: 63, scale: 0.34 },
  "6M": { from: "2026-05-04", to: "2026-10-30", observations: 126, scale: 0.56 },
  "1A": { from: "2025-11-03", to: "2026-10-30", observations: 252, scale: 1.0 },
  "3A": { from: "2023-11-01", to: "2026-10-30", observations: 756, scale: 2.35 },
};

const BASE_METRICS: Record<
  string,
  {
    simple1Y: number;
    log1Y: number;
    dailyMean: number;
    volDaily: number;
    volAnnual: number;
    maxDrawdown: number;
    peakDate: string;
    troughDate: string;
    points1Y: [string, number][];
  }
> = {
  AAPL: {
    simple1Y: 0.198,
    log1Y: 0.1807,
    dailyMean: 0.00079,
    volDaily: 0.0156,
    volAnnual: 0.2476,
    maxDrawdown: -0.142,
    peakDate: "2026-02-12",
    troughDate: "2026-04-08",
    points1Y: [
      ["2025-11-03", 100],
      ["2026-01-05", 105.4],
      ["2026-02-12", 111.8],
      ["2026-04-08", 95.9],
      ["2026-06-15", 107.2],
      ["2026-08-24", 114.6],
      ["2026-10-30", 119.8],
    ],
  },
  MSFT: {
    simple1Y: 0.164,
    log1Y: 0.1519,
    dailyMean: 0.00066,
    volDaily: 0.0141,
    volAnnual: 0.2238,
    maxDrawdown: -0.118,
    peakDate: "2026-02-19",
    troughDate: "2026-04-11",
    points1Y: [
      ["2025-11-03", 100],
      ["2026-01-05", 103.8],
      ["2026-02-19", 109.5],
      ["2026-04-11", 96.6],
      ["2026-06-15", 104.9],
      ["2026-08-24", 111.2],
      ["2026-10-30", 116.4],
    ],
  },
  JPM: {
    simple1Y: 0.121,
    log1Y: 0.1142,
    dailyMean: 0.00049,
    volDaily: 0.0124,
    volAnnual: 0.1968,
    maxDrawdown: -0.094,
    peakDate: "2026-03-04",
    troughDate: "2026-05-02",
    points1Y: [
      ["2025-11-03", 100],
      ["2026-01-05", 102.2],
      ["2026-03-04", 106.4],
      ["2026-05-02", 96.4],
      ["2026-06-15", 102.9],
      ["2026-08-24", 108.1],
      ["2026-10-30", 112.1],
    ],
  },
  "WALMEX.MX": {
    simple1Y: 0.084,
    log1Y: 0.0807,
    dailyMean: 0.00034,
    volDaily: 0.0115,
    volAnnual: 0.1826,
    maxDrawdown: -0.081,
    peakDate: "2026-01-28",
    troughDate: "2026-03-19",
    points1Y: [
      ["2025-11-03", 100],
      ["2026-01-28", 104.2],
      ["2026-02-18", 101.6],
      ["2026-03-19", 95.8],
      ["2026-06-15", 101.1],
      ["2026-08-24", 105.0],
      ["2026-10-30", 108.4],
    ],
  },
  XOM: {
    simple1Y: -0.024,
    log1Y: -0.0243,
    dailyMean: -0.00009,
    volDaily: 0.0149,
    volAnnual: 0.2365,
    maxDrawdown: -0.173,
    peakDate: "2026-01-16",
    troughDate: "2026-07-09",
    points1Y: [
      ["2025-11-03", 100],
      ["2026-01-16", 107.1],
      ["2026-03-12", 102.3],
      ["2026-05-08", 94.8],
      ["2026-07-09", 88.6],
      ["2026-08-24", 93.9],
      ["2026-10-30", 97.6],
    ],
  },
};

const PAIR_CORRELATIONS: Record<string, number> = {
  "AAPL|MSFT": 0.74,
  "AAPL|JPM": 0.42,
  "AAPL|WALMEX.MX": 0.21,
  "AAPL|XOM": 0.12,
  "JPM|MSFT": 0.46,
  "MSFT|WALMEX.MX": 0.19,
  "MSFT|XOM": 0.09,
  "JPM|WALMEX.MX": 0.28,
  "JPM|XOM": 0.37,
  "WALMEX.MX|XOM": -0.08,
};

function getCorrelation(a: string, b: string): number {
  if (a === b) return 1;
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  return PAIR_CORRELATIONS[key] ?? 0;
}

export function buildAssetAnalysisFixture(params: {
  symbols?: string[];
  period?: PeriodPreset;
  from?: string;
  to?: string;
  returnKind?: ReturnKind;
  scenario?: ViewScenario;
}): AdapterResult<AssetAnalysisData> {
  const scenario = params.scenario ?? "normal";
  const period = params.period ?? "1A";
  const returnKind = params.returnKind ?? "simple";
  const selectedSymbols =
    params.symbols && params.symbols.length > 0 ? params.symbols : ["AAPL", "MSFT", "JPM", "WALMEX.MX"];

  if (scenario === "vacio") {
    return {
      status: "empty",
      title: "Sin activos seleccionados para analizar",
      message: "Elige al menos un activo con precios cargados para calcular rendimientos, volatilidad y correlaciones.",
      actionLabel: "Explorar Seguimiento de mercado",
      actionHref: "/app/mercado",
    };
  }

  if (scenario === "no-disponible") {
    return {
      status: "unavailable",
      title: "Motor de análisis temporalmente no disponible",
      message: "No fue posible consultar el servicio cuantitativo en este momento. Inténtalo de nuevo más tarde.",
      lastUpdated: "2026-10-30 16:05",
    };
  }

  if (scenario === "denegado") {
    return {
      status: "forbidden",
      title: "Acceso restringido al análisis",
      message: "Tu sesión actual no tiene permiso para consultar estas series de mercado.",
    };
  }

  const reqFrom = period === "custom" ? (params.from ?? "2026-01-05") : PERIOD_SPECS[period].from;
  const reqTo = period === "custom" ? (params.to ?? "2026-10-30") : PERIOD_SPECS[period].to;

  if (scenario === "validacion") {
    return {
      status: "validation_error",
      title: "Parámetros de período inválidos",
      message: "Corrige el intervalo de fechas antes de solicitar el cálculo al motor Julia.",
      issues: validateDateRange("2026-10-30", "2026-01-05"),
    };
  }

  if (period === "custom") {
    const issues = validateDateRange(reqFrom, reqTo);
    if (issues.length > 0) {
      return {
        status: "validation_error",
        title: "Intervalo personalizado inválido",
        message: "Revisa las fechas ingresadas para el análisis.",
        issues,
      };
    }
  }

  const spanDays = Math.max(1, Math.round((Date.parse(reqTo) - Date.parse(reqFrom)) / 86_400_000));
  const approxSessions = period === "custom" ? Math.round((spanDays * 252) / 365) : PERIOD_SPECS[period].observations;

  if (scenario === "pocos-datos" || selectedSymbols.includes("NU") || approxSessions < 20) {
    const obs = selectedSymbols.includes("NU") ? 12 : Math.min(approxSessions, 14);
    return {
      status: "insufficient_data",
      title: "Histórico insuficiente para el período elegido",
      message:
        "Para calcular volatilidad anualizada, drawdown y matriz de correlación con validez estadística se requieren al menos 20 sesiones alineadas en común.",
      details: [
        selectedSymbols.includes("NU")
          ? "NU solo cuenta con 12 sesiones históricas cargadas."
          : `El rango ${reqFrom} a ${reqTo} solo cubre ${obs} sesiones hábiles alineadas.`,
        "Amplía el período de análisis o retira los activos con historial corto.",
      ],
      effectiveRange: {
        from: selectedSymbols.includes("NU") ? "2026-10-15" : reqFrom,
        to: reqTo,
        observations: obs,
        required: 20,
      },
    };
  }

  const scale = period === "custom" ? Math.max(0.25, Math.min(2.4, approxSessions / 252)) : PERIOD_SPECS[period].scale;

  const validItems = ASSET_CATALOG.filter((item) => selectedSymbols.includes(item.symbol) && BASE_METRICS[item.symbol]);
  const metrics: AssetAnalysisMetricRow[] = validItems.map((item) => {
    const base = BASE_METRICS[item.symbol];
    const scaledSimple = Number((base.simple1Y * scale).toFixed(4));
    const scaledLog = Number(Math.log(Math.max(0.05, 1 + scaledSimple)).toFixed(4));
    return {
      assetId: item.id,
      symbol: item.symbol,
      name: item.name,
      currency: item.currency,
      observations: approxSessions,
      effectiveFrom: reqFrom,
      effectiveTo: reqTo,
      simpleReturn: scaledSimple,
      logReturn: scaledLog,
      cumulativeReturn: returnKind === "log" ? scaledLog : scaledSimple,
      meanReturnDaily: Number((base.dailyMean * (scale > 1 ? 0.92 : 1)).toFixed(6)),
      volatilityDaily: base.volDaily,
      volatilityAnnualized: base.volAnnual,
      maxDrawdown: Number((base.maxDrawdown * Math.min(1.25, Math.sqrt(scale))).toFixed(4)),
      peakDate: base.peakDate,
      troughDate: base.troughDate,
    };
  });

  const correlationSymbols = validItems.map((item) => item.symbol);
  const correlationMatrix = correlationSymbols.map((rowSym) =>
    correlationSymbols.map((colSym) => getCorrelation(rowSym, colSym)),
  );

  const startMs = Date.parse(`${reqFrom}T00:00:00Z`);
  const endMs = Date.parse(`${reqTo}T00:00:00Z`);
  const series: NormalizedAssetSeries[] = validItems.map((item) => {
    const base = BASE_METRICS[item.symbol];
    const lastIdx = base.points1Y.length - 1;
    const scaledPoints: [string, number][] = base.points1Y.map(([, val], idx) => {
      const pointDate =
        idx === 0
          ? reqFrom
          : idx === lastIdx
            ? reqTo
            : new Date(startMs + Math.round(((endMs - startMs) * idx) / lastIdx)).toISOString().slice(0, 10);
      const delta = idx === 0 ? 0 : (val - 100) * scale;
      return [pointDate, Number((100 + delta).toFixed(2))];
    });
    return { symbol: item.symbol, points: scaledPoints };
  });

  return {
    status: "ok",
    data: {
      catalog: [...ASSET_CATALOG],
      selectedSymbols: validItems.map((item) => item.symbol),
      periodPreset: period,
      returnKind,
      requestedFrom: reqFrom,
      requestedTo: reqTo,
      effectiveFrom: reqFrom,
      effectiveTo: reqTo,
      alignedObservations: approxSessions,
      annualizationFactor: 252,
      metrics,
      correlationSymbols,
      correlationMatrix,
      series,
    },
    provenance: {
      origin: "fixtures",
      freshness: "example",
      isExample: true,
      calculatedAt: "2026-10-30 16:10",
      effectiveRange: {
        from: reqFrom,
        to: reqTo,
        observations: approxSessions,
      },
      assumptions: "Base 252 días hábiles/año · Matriz de Pearson por sesiones alineadas",
    },
  };
}

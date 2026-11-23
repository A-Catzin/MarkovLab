import type { AdapterResult, ViewScenario } from "../runtime";
import type { BacktestingData, BacktestRunRecord } from "../types";

const STRATEGIES = [
  {
    id: "bt-1",
    name: "Máximo Sharpe con rebalanceo trimestral",
    description: "Calibra pesos óptimos solo con datos del período de configuración y rebalancea cada trimestre.",
  },
  {
    id: "bt-2",
    name: "Mínima varianza con tope 35 % por activo",
    description: "Minimiza volatilidad histórica fuera de muestra manteniendo límites por emisor y costos explícitos.",
  },
  {
    id: "bt-3",
    name: "Paridad equiponderada (25 % × 4)",
    description: "Referencia neutral sin optimización, rebalanceada semestralmente sin sesgo de selección posterior.",
  },
];

const BENCHMARKS = [
  { symbol: "SP500", label: "S&P 500 (benchmark USD)" },
  { symbol: "IPC", label: "S&P/BMV IPC (benchmark MXN)" },
  { symbol: "NONE", label: "Sin benchmark (solo estrategia)" },
];

const RUNS: BacktestRunRecord[] = [
  {
    id: "bt-1",
    strategyName: "Máximo Sharpe con rebalanceo trimestral",
    rebalanceLabel: "Trimestral · costo supuesto 10 pb",
    benchmarkSymbol: "SP500",
    configFrom: "2022-01-03",
    configTo: "2024-12-31",
    evalFrom: "2025-01-02",
    evalTo: "2026-10-30",
    transactionCostBps: 10,
    strategyMetrics: {
      cumulativeReturn: 0.284,
      annualizedReturn: 0.149,
      annualizedVolatility: 0.146,
      maxDrawdown: -0.098,
      sharpeRatio: 0.71,
    },
    benchmarkMetrics: {
      cumulativeReturn: 0.221,
      annualizedReturn: 0.118,
      annualizedVolatility: 0.159,
      maxDrawdown: -0.117,
      sharpeRatio: 0.46,
    },
    executedAt: "2026-10-30 16:12",
    curve: [
      { date: "2022-01-03", phase: "config", strategyIndex: 100, benchmarkIndex: 100 },
      { date: "2022-12-30", phase: "config", strategyIndex: 94.2, benchmarkIndex: 91.5 },
      { date: "2023-12-29", phase: "config", strategyIndex: 112.4, benchmarkIndex: 108.9 },
      { date: "2024-12-31", phase: "config", strategyIndex: 126.0, benchmarkIndex: 121.0 },
      { date: "2025-04-15", phase: "evaluation", strategyIndex: 121.8, benchmarkIndex: 115.2 },
      { date: "2025-09-30", phase: "evaluation", strategyIndex: 138.6, benchmarkIndex: 130.4 },
      { date: "2026-04-30", phase: "evaluation", strategyIndex: 149.4, benchmarkIndex: 139.1 },
      { date: "2026-10-30", phase: "evaluation", strategyIndex: 161.8, benchmarkIndex: 147.7 },
    ],
  },
  {
    id: "bt-2",
    strategyName: "Mínima varianza con tope 35 % por activo",
    rebalanceLabel: "Mensual · costo supuesto 10 pb",
    benchmarkSymbol: "IPC",
    configFrom: "2022-01-03",
    configTo: "2024-12-31",
    evalFrom: "2025-01-02",
    evalTo: "2026-10-30",
    transactionCostBps: 10,
    strategyMetrics: {
      cumulativeReturn: 0.196,
      annualizedReturn: 0.105,
      annualizedVolatility: 0.109,
      maxDrawdown: -0.068,
      sharpeRatio: 0.55,
    },
    benchmarkMetrics: {
      cumulativeReturn: 0.142,
      annualizedReturn: 0.077,
      annualizedVolatility: 0.148,
      maxDrawdown: -0.105,
      sharpeRatio: 0.22,
    },
    executedAt: "2026-10-29 18:40",
    curve: [
      { date: "2022-01-03", phase: "config", strategyIndex: 100, benchmarkIndex: 100 },
      { date: "2022-12-30", phase: "config", strategyIndex: 98.1, benchmarkIndex: 95.4 },
      { date: "2023-12-29", phase: "config", strategyIndex: 109.6, benchmarkIndex: 106.2 },
      { date: "2024-12-31", phase: "config", strategyIndex: 118.4, benchmarkIndex: 112.0 },
      { date: "2025-04-15", phase: "evaluation", strategyIndex: 116.1, benchmarkIndex: 107.4 },
      { date: "2025-09-30", phase: "evaluation", strategyIndex: 127.3, benchmarkIndex: 118.1 },
      { date: "2026-04-30", phase: "evaluation", strategyIndex: 134.8, benchmarkIndex: 122.9 },
      { date: "2026-10-30", phase: "evaluation", strategyIndex: 141.6, benchmarkIndex: 127.9 },
    ],
  },
  {
    id: "bt-3",
    strategyName: "Paridad equiponderada (25 % × 4)",
    rebalanceLabel: "Semestral · sin costo de entrada",
    benchmarkSymbol: null,
    configFrom: "2022-01-03",
    configTo: "2024-12-31",
    evalFrom: "2025-01-02",
    evalTo: "2026-10-30",
    transactionCostBps: 0,
    strategyMetrics: {
      cumulativeReturn: 0.214,
      annualizedReturn: 0.114,
      annualizedVolatility: 0.132,
      maxDrawdown: -0.089,
      sharpeRatio: 0.52,
    },
    benchmarkMetrics: null,
    executedAt: "2026-10-25 12:15",
    curve: [
      { date: "2022-01-03", phase: "config", strategyIndex: 100, benchmarkIndex: null },
      { date: "2022-12-30", phase: "config", strategyIndex: 95.5, benchmarkIndex: null },
      { date: "2023-12-29", phase: "config", strategyIndex: 108.9, benchmarkIndex: null },
      { date: "2024-12-31", phase: "config", strategyIndex: 120.2, benchmarkIndex: null },
      { date: "2025-04-15", phase: "evaluation", strategyIndex: 117.0, benchmarkIndex: null },
      { date: "2025-09-30", phase: "evaluation", strategyIndex: 129.8, benchmarkIndex: null },
      { date: "2026-04-30", phase: "evaluation", strategyIndex: 138.2, benchmarkIndex: null },
      { date: "2026-10-30", phase: "evaluation", strategyIndex: 145.9, benchmarkIndex: null },
    ],
  },
];

export function buildBacktestingFixture(params: {
  runId?: string;
  scenario?: ViewScenario;
}): AdapterResult<BacktestingData> {
  const scenario = params.scenario ?? "normal";
  const activeRunId = RUNS.some((r) => r.id === params.runId) ? (params.runId as string) : "bt-1";

  if (scenario === "vacio") {
    return {
      status: "empty",
      title: "No hay ejecuciones de backtesting registradas",
      message: "Define un período de configuración, una ventana de evaluación posterior y ejecuta una prueba histórica para ver métricas fuera de muestra.",
      actionLabel: "Ir al inicio del laboratorio",
      actionHref: "/app",
    };
  }
  if (scenario === "pocos-datos") {
    return {
      status: "insufficient_data",
      title: "Ventana de evaluación demasiado corta",
      message: "La evaluación fuera de muestra requiere al menos 60 sesiones posteriores al corte de configuración.",
      details: ["Ventana evaluada: 14 sesiones hábiles entre 2026-10-12 y 2026-10-30."],
      effectiveRange: { from: "2026-10-12", to: "2026-10-30", observations: 14, required: 60 },
    };
  }
  if (scenario === "validacion") {
    return {
      status: "validation_error",
      title: "Fuga temporal detectada entre ventanas",
      message: "La ventana de evaluación no puede solaparse con la ventana de configuración.",
      issues: [
        {
          field: "bt-eval-from",
          message:
            "El período de evaluación fuera de muestra debe comenzar estrictamente después de que termine el período de configuración.",
        },
      ],
    };
  }
  if (scenario === "no-disponible") {
    return {
      status: "unavailable",
      title: "Motor de backtesting no disponible",
      message: "No pudimos consultar las ejecuciones guardadas ni lanzar la evaluación histórica.",
      lastUpdated: "2026-10-30 16:12",
    };
  }
  if (scenario === "denegado") {
    return {
      status: "forbidden",
      title: "Acceso denegado al historial de backtesting",
      message: "Cada usuario solo puede consultar sus propias estrategias evaluadas.",
    };
  }

  return {
    status: "ok",
    data: {
      strategies: STRATEGIES,
      benchmarks: BENCHMARKS,
      runs: RUNS,
      activeRunId,
    },
    provenance: {
      origin: "fixtures",
      freshness: "example",
      isExample: true,
      calculatedAt: "2026-10-30 16:12",
      effectiveRange: { from: "2022-01-03", to: "2026-10-30", observations: 1210 },
      assumptions: "Separación estricta configuración (2022–2024) vs evaluación fuera de muestra (2025–2026)",
    },
  };
}

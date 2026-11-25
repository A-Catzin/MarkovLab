import type { AdapterResult, ViewScenario } from "../runtime";
import type {
  OptimizationData,
  OptimizationObjective,
  OptimizationPortfolioStats,
  OptimizationWeightRow,
} from "../types";
import { validateOptimizationConstraints } from "../validators";

const ASSETS_OPT: Omit<OptimizationWeightRow, "optimizedWeight">[] = [
  { assetId: 1, symbol: "AAPL", name: "Apple Inc.", manualWeight: 0.3, minWeight: 0.05, maxWeight: 0.45 },
  { assetId: 2, symbol: "MSFT", name: "Microsoft Corp.", manualWeight: 0.3, minWeight: 0.05, maxWeight: 0.45 },
  { assetId: 3, symbol: "JPM", name: "JPMorgan Chase & Co.", manualWeight: 0.2, minWeight: 0.05, maxWeight: 0.4 },
  { assetId: 4, symbol: "WALMEX.MX", name: "Wal-Mart de México", manualWeight: 0.1, minWeight: 0.05, maxWeight: 0.45 },
  { assetId: 5, symbol: "XOM", name: "Exxon Mobil Corp.", manualWeight: 0.1, minWeight: 0.05, maxWeight: 0.35 },
];

const SOLVED_WEIGHTS: Record<OptimizationObjective, number[]> = {
  min_variance: [0.1, 0.14, 0.21, 0.38, 0.17],
  max_sharpe: [0.32, 0.35, 0.16, 0.11, 0.06],
};

const STATS: Record<OptimizationObjective, OptimizationPortfolioStats> = {
  min_variance: {
    expectedAnnualReturn: 0.109,
    annualizedVolatility: 0.114,
    sharpeRatio: 0.56,
  },
  max_sharpe: {
    expectedAnnualReturn: 0.158,
    annualizedVolatility: 0.154,
    sharpeRatio: 0.73,
  },
};

const FEASIBLE_MIN_VOLATILITY = 0.114;

export function buildOptimizationFixture(params: {
  objective?: OptimizationObjective;
  maxVolatilityCap?: number | null;
  constraints?: { symbol: string; minWeight: number; maxWeight: number }[];
  scenario?: ViewScenario;
}): AdapterResult<OptimizationData> {
  const scenario = params.scenario ?? "normal";
  const objective: OptimizationObjective = params.objective === "min_variance" ? "min_variance" : "max_sharpe";
  const maxVolatilityCap = params.maxVolatilityCap ?? null;

  if (scenario === "vacio") {
    return {
      status: "empty",
      title: "Sin cartera base seleccionada para optimizar",
      message: "Crea o elige una cartera con al menos dos activos y pesos iniciales para comparar contra la solución optimizada.",
      actionLabel: "Ir a Mis carteras",
      actionHref: "/app/carteras",
    };
  }
  if (scenario === "pocos-datos") {
    return {
      status: "insufficient_data",
      title: "Histórico insuficiente para estimar matriz de covarianza",
      message: "No hay suficientes rendimientos alineados entre todos los activos seleccionados para resolver el problema cuadrático.",
      details: ["Se requieren al menos 60 sesiones alineadas sin brechas para estimar la covarianza muestral."],
      effectiveRange: { from: "2026-09-25", to: "2026-10-30", observations: 25, required: 60 },
    };
  }
  if (scenario === "no-disponible") {
    return {
      status: "unavailable",
      title: "Optimizador temporalmente no disponible",
      message: "No fue posible conectar con el solver JuMP/HiGHS en Julia. Inténtalo de nuevo más tarde.",
      lastUpdated: "2026-10-30 16:05",
    };
  }
  if (scenario === "denegado") {
    return {
      status: "forbidden",
      title: "Cartera no accesible",
      message: "No tienes permisos para optimizar una cartera que pertenece a otro usuario.",
    };
  }

  const effectiveConstraints =
    params.constraints ?? ASSETS_OPT.map((row) => ({ symbol: row.symbol, minWeight: row.minWeight, maxWeight: row.maxWeight }));

  if (scenario === "validacion") {
    return {
      status: "validation_error",
      title: "Límites numéricos inválidos en la tabla de restricciones",
      message: "Todos los límites porcentuales y el tope opcional de volatilidad deben estar dentro de rangos válidos.",
      issues: [
        {
          field: "opt-max-vol",
          message: "El tope de volatilidad anualizada debe ser mayor a 0 % y menor a 200 %.",
        },
      ],
    };
  }

  const check = validateOptimizationConstraints(effectiveConstraints, maxVolatilityCap, FEASIBLE_MIN_VOLATILITY);
  if (check.issues.length > 0) {
    return {
      status: "validation_error",
      title: "Revisa los límites ingresados",
      message: "Alguno de los límites porcentuales está fuera del intervalo 0 % – 100 %.",
      issues: check.issues,
    };
  }

  if (scenario === "inviable" || check.infeasibleReasons.length > 0) {
    const conflicts =
      check.infeasibleReasons.length > 0
        ? check.infeasibleReasons
        : [
            "Con un tope de riesgo máximo de 8.00 %, ninguna combinación dentro de los límites cumple la volatilidad mínima alcanzable (11.40 %).",
          ];
    return {
      status: "infeasible",
      title: "No existe una solución factible con estas restricciones",
      message:
        "Las restricciones ingresadas se contradicen entre sí o exigen un nivel de riesgo menor al mínimo alcanzable con los activos seleccionados.",
      conflicts,
    };
  }

  const solved = SOLVED_WEIGHTS[objective];
  const weights: OptimizationWeightRow[] = ASSETS_OPT.map((row, idx) => ({
    ...row,
    optimizedWeight: solved[idx],
  }));
  const manualStats = {
    expectedAnnualReturn: 0.146,
    annualizedVolatility: 0.168,
    sharpeRatio: 0.6,
  };
  const optimizedStats = STATS[objective];
  const activeRun = {
    id: `demo-opt-${objective}`,
    createdAt: "2026-10-30T16:25:00Z",
    portfolioId: "pf-v3",
    portfolioVersion: 3,
    portfolioName: "Núcleo Académico · v3",
    capital: 250000,
    currency: "MXN",
    startDate: "2025-11-03",
    objective,
    objectiveValue:
      objective === "min_variance"
        ? optimizedStats.annualizedVolatility ** 2
        : (optimizedStats.sharpeRatio ?? 0),
    returnModel: "daily_simple_arithmetic_v1",
    periodsPerYear: 252,
    riskFreeRate: 0.045,
    lookbackYears: 5,
    maxVolatilityCap,
    feasibleMinVolatility: FEASIBLE_MIN_VOLATILITY,
    window: { from: "2025-11-03", to: "2026-10-30" },
    observations: 252,
    weights,
    manualStats,
    optimizedStats,
    solver: "HiGHS",
    solverWrapperVersion: "1.27.0",
  };
  const altObjective: OptimizationObjective = objective === "min_variance" ? "max_sharpe" : "min_variance";
  const altRun = {
    ...activeRun,
    id: `demo-opt-${altObjective}`,
    createdAt: "2026-10-29T15:10:00Z",
    objective: altObjective,
    objectiveValue:
      altObjective === "min_variance"
        ? STATS[altObjective].annualizedVolatility ** 2
        : (STATS[altObjective].sharpeRatio ?? 0),
    weights: ASSETS_OPT.map((row, idx) => ({
      ...row,
      optimizedWeight: SOLVED_WEIGHTS[altObjective][idx],
    })),
    optimizedStats: STATS[altObjective],
  };

  return {
    status: "ok",
    data: {
      portfolioId: "pf-v3",
      portfolioName: "Núcleo Académico · v3",
      currency: "MXN",
      objective,
      frequencyLabel: "Rendimientos diarios anualizados (252 días/año)",
      riskFreeRate: 0.045,
      lookbackYears: 5,
      maxVolatilityCap,
      feasibleMinVolatility: FEASIBLE_MIN_VOLATILITY,
      weights,
      manualStats,
      optimizedStats,
      activeRun,
      history: [activeRun, altRun],
    },
    provenance: {
      origin: "fixtures",
      freshness: "example",
      isExample: true,
      calculatedAt: "2026-10-30 16:25",
      effectiveRange: { from: "2025-11-03", to: "2026-10-30", observations: 252 },
      assumptions: "Tasa libre de riesgo 4.50 % anual · Datos sintéticos de demostración (sin recomendación financiera)",
    },
  };
}

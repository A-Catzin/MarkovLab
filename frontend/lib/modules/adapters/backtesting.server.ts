import "server-only";
import {
  isLocalFixturesEnabled,
  mapCommonBackendFailure,
  type AdapterResult,
  type ValidationIssue,
  type ViewScenario,
} from "../runtime";
import type {
  BacktestCurvePoint,
  BacktestMetricsBlock,
  BacktestRebalanceFrequency,
  BacktestRunRecord,
  BacktestStrategyId,
  BacktestingData,
} from "../types";
import { validateBacktestWindows } from "../validators";

interface BackendBacktestMetrics {
  cumulative_return: number;
  annualized_return: number;
  annualized_volatility: number;
  max_drawdown: number;
  sharpe_ratio: number | null;
}

interface BackendBacktestRun {
  id: string;
  portfolio_id: string;
  portfolio_version: number;
  portfolio_name: string;
  currency: string;
  executed_at: string;
  model: string;
  strategy: BacktestStrategyId;
  config_from: string;
  config_to: string;
  eval_from: string;
  eval_to: string;
  rebalance: BacktestRebalanceFrequency;
  transaction_cost_bps: number;
  risk_free_rate: number;
  configuration: { from: string; to: string; observations: number };
  evaluation: { from: string; to: string; observations: number };
  weights: {
    asset_id: number;
    symbol: string;
    market: string;
    manual_weight: number;
    target_weight: number;
  }[];
  benchmark: {
    asset_id: number;
    symbol: string;
    market: string;
    currency: string;
  } | null;
  strategy_metrics: BackendBacktestMetrics;
  benchmark_metrics: BackendBacktestMetrics | null;
  curve: {
    date: string;
    phase: "config" | "evaluation";
    strategy_index: number;
    benchmark_index: number | null;
  }[];
}

const STRATEGY_LABELS: Record<BacktestStrategyId, string> = {
  manual: "Pesos manuales",
  min_variance: "Mínima varianza",
  max_sharpe: "Máximo Sharpe",
};

const REBALANCE_LABELS: Record<BacktestRebalanceFrequency, string> = {
  none: "Sin rebalanceo",
  monthly: "Mensual",
  quarterly: "Trimestral",
  semiannual: "Semestral",
};

const STRATEGY_OPTIONS: { id: BacktestStrategyId; name: string; description: string }[] = [
  {
    id: "min_variance",
    name: "Mínima varianza",
    description: "Calibra pesos óptimos exclusivamente sobre el período de configuración minimizando varianza.",
  },
  {
    id: "max_sharpe",
    name: "Máximo Sharpe",
    description: "Calibra pesos de máximo Sharpe sobre configuración con la tasa libre de riesgo indicada.",
  },
  {
    id: "manual",
    name: "Pesos manuales de la cartera",
    description: "Evalúa fuera de muestra los pesos vigentes declarados en la cartera.",
  },
];

export type BacktestExecuteResult =
  | { ok: true; run: BacktestRunRecord }
  | {
      ok: false;
      kind:
        | "validation"
        | "insufficient_data"
        | "infeasible"
        | "undefined_sharpe"
        | "unavailable"
        | "forbidden"
        | "not_found";
      title: string;
      message: string;
      issues?: ValidationIssue[];
    };

function mapMetrics(raw: BackendBacktestMetrics): BacktestMetricsBlock {
  return {
    cumulativeReturn: raw.cumulative_return,
    annualizedReturn: raw.annualized_return,
    annualizedVolatility: raw.annualized_volatility,
    maxDrawdown: raw.max_drawdown,
    sharpeRatio: raw.sharpe_ratio,
  };
}

function mapCurve(raw: BackendBacktestRun["curve"]): BacktestCurvePoint[] {
  return raw.map((pt) => ({
    date: pt.date,
    phase: pt.phase,
    strategyIndex: pt.strategy_index,
    benchmarkIndex: pt.benchmark_index,
  }));
}

function mapBacktestRun(raw: BackendBacktestRun): BacktestRunRecord {
  const stratLabel = STRATEGY_LABELS[raw.strategy] ?? raw.strategy;
  const rebLabel = REBALANCE_LABELS[raw.rebalance] ?? raw.rebalance;
  return {
    id: raw.id,
    portfolioId: raw.portfolio_id,
    portfolioVersion: raw.portfolio_version,
    portfolioName: raw.portfolio_name,
    currency: raw.currency.trim(),
    model: raw.model,
    strategy: raw.strategy,
    strategyName: stratLabel,
    rebalance: raw.rebalance,
    rebalanceLabel: `${rebLabel} · costo ${raw.transaction_cost_bps} pb`,
    benchmarkAssetId: raw.benchmark?.asset_id ?? null,
    benchmarkSymbol: raw.benchmark?.symbol ?? null,
    benchmarkCurrency: raw.benchmark?.currency?.trim() ?? null,
    configFrom: raw.config_from,
    configTo: raw.config_to,
    evalFrom: raw.eval_from,
    evalTo: raw.eval_to,
    configurationWindow: raw.configuration,
    evaluationWindow: raw.evaluation,
    transactionCostBps: raw.transaction_cost_bps,
    riskFreeRate: raw.risk_free_rate,
    weights: raw.weights.map((row) => ({
      assetId: row.asset_id,
      symbol: row.symbol,
      market: row.market,
      manualWeight: row.manual_weight,
      targetWeight: row.target_weight,
    })),
    strategyMetrics: mapMetrics(raw.strategy_metrics),
    benchmarkMetrics: raw.benchmark_metrics ? mapMetrics(raw.benchmark_metrics) : null,
    executedAt: raw.executed_at,
    curve: mapCurve(raw.curve),
  };
}

export async function executePortfolioBacktest(params: {
  actorId: string;
  portfolioId: string;
  strategy: BacktestStrategyId;
  configFrom: string;
  configTo: string;
  evalFrom: string;
  evalTo: string;
  rebalance?: BacktestRebalanceFrequency;
  transactionCostBps?: number;
  riskFreeRate?: number;
  benchmarkId?: number | null;
}): Promise<BacktestExecuteResult> {
  const rebalance: BacktestRebalanceFrequency = params.rebalance ?? "none";
  const transactionCostBps = params.transactionCostBps ?? 0;
  const riskFreeRate = params.riskFreeRate ?? 0;
  const benchmarkId = params.benchmarkId ?? null;

  const issues = validateBacktestWindows({
    configFrom: params.configFrom,
    configTo: params.configTo,
    evalFrom: params.evalFrom,
    evalTo: params.evalTo,
  });

  if (
    params.strategy !== "manual" &&
    params.strategy !== "min_variance" &&
    params.strategy !== "max_sharpe"
  ) {
    issues.push({ field: "bt-strategy", message: "Elige una estrategia válida (manual, mínima varianza o máximo Sharpe)." });
  }
  if (
    rebalance !== "none" &&
    rebalance !== "monthly" &&
    rebalance !== "quarterly" &&
    rebalance !== "semiannual"
  ) {
    issues.push({ field: "bt-rebalance", message: "Elige una frecuencia de rebalanceo válida." });
  }
  if (!Number.isFinite(transactionCostBps) || transactionCostBps < 0 || transactionCostBps > 1000) {
    issues.push({ field: "bt-cost-bps", message: "El costo de transacción debe estar entre 0 y 1000 pb." });
  }
  if (!Number.isFinite(riskFreeRate) || riskFreeRate < -1 || riskFreeRate > 1) {
    issues.push({ field: "bt-rf-rate", message: "La tasa libre de riesgo anual debe estar entre -100 % y +100 %." });
  }
  if (benchmarkId !== null && (!Number.isInteger(benchmarkId) || benchmarkId <= 0)) {
    issues.push({ field: "bt-benchmark", message: "El benchmark seleccionado no es válido." });
  }

  if (issues.length > 0) {
    return {
      ok: false,
      kind: "validation",
      title: "Revisa las ventanas y parámetros del backtest",
      message: "Corrige los campos señalados antes de ejecutar la prueba histórica.",
      issues,
    };
  }

  try {
    const { backendFetch, BackendError } = await import("@/lib/backend");
    const body: {
      strategy: BacktestStrategyId;
      config_from: string;
      config_to: string;
      eval_from: string;
      eval_to: string;
      rebalance: BacktestRebalanceFrequency;
      transaction_cost_bps: number;
      risk_free_rate: number;
      benchmark_id?: number;
    } = {
      strategy: params.strategy,
      config_from: params.configFrom,
      config_to: params.configTo,
      eval_from: params.evalFrom,
      eval_to: params.evalTo,
      rebalance,
      transaction_cost_bps: transactionCostBps,
      risk_free_rate: riskFreeRate,
    };
    if (benchmarkId !== null) {
      body.benchmark_id = benchmarkId;
    }

    try {
      const saved = await backendFetch<BackendBacktestRun>(
        `/api/internal/portfolios/${encodeURIComponent(params.portfolioId)}/backtests`,
        {
          method: "POST",
          actorId: params.actorId,
          body,
        },
      );
      return { ok: true, run: mapBacktestRun(saved) };
    } catch (error) {
      if (error instanceof BackendError) {
        if (error.status === 422 && error.code === "insufficient_data") {
          return {
            ok: false,
            kind: "insufficient_data",
            title: "Histórico común insuficiente en alguna ventana",
            message:
              "La cartera (o el benchmark) no tiene suficientes cierres compartidos dentro del rango de configuración o evaluación.",
          };
        }
        if (error.status === 422 && error.code === "missing_exchange_rate") {
          return {
            ok: false,
            kind: "unavailable",
            title: "Falta tipo de cambio para valuar activos o benchmark",
            message:
              "Alguno de los activos o el benchmark cotiza en otra moneda y falta el tipo de cambio necesario.",
          };
        }
        if (error.status === 422 && error.code === "undefined_sharpe") {
          return {
            ok: false,
            kind: "undefined_sharpe",
            title: "Ratio Sharpe no definido en calibración",
            message:
              "La volatilidad histórica en la ventana de configuración no permite calcular el máximo Sharpe.",
          };
        }
        if (error.status === 422 && error.code === "optimization_infeasible") {
          return {
            ok: false,
            kind: "infeasible",
            title: "No pudo calibrarse la estrategia en configuración",
            message: "Los datos históricos de configuración no admiten una solución factible.",
          };
        }
        if (error.status === 400) {
          return {
            ok: false,
            kind: "validation",
            title: "Parámetros rechazados por la API",
            message: error.message || "Revisa fechas, estrategia y supuestos ingresados.",
            issues: [{ field: "bt-eval-from", message: error.message || "Parámetros inválidos." }],
          };
        }
        if (error.status === 404) {
          return {
            ok: false,
            kind: "not_found",
            title: "Cartera o benchmark no encontrado",
            message: "La cartera o el activo benchmark seleccionado ya no está disponible.",
          };
        }
        if (error.status === 401 || error.status === 403) {
          return {
            ok: false,
            kind: "forbidden",
            title: "Acceso no autorizado",
            message: "Tu sesión actual no tiene permisos para ejecutar backtesting sobre esta cartera.",
          };
        }
        if (error.code === "optimization_unavailable") {
          return {
            ok: false,
            kind: "unavailable",
            title: "El solver no pudo certificar pesos de calibración",
            message:
              "El motor de optimización en Julia no pudo certificar solución en el período de configuración.",
          };
        }
      }
      throw error;
    }
  } catch (error) {
    const common = mapCommonBackendFailure(
      error,
      "Motor de backtesting temporalmente no disponible",
      "No fue posible conectar con el servicio de backtesting en Julia.",
    );
    if (common && common.status === "forbidden") {
      return { ok: false, kind: "forbidden", title: common.title, message: common.message };
    }
    return {
      ok: false,
      kind: "unavailable",
      title: "Motor de backtesting temporalmente no disponible",
      message: "No fue posible conectar con el servicio de backtesting en Julia.",
    };
  }
}

export async function loadBacktestingView(params: {
  actorId: string;
  portfolioId?: string;
  runId?: string;
  scenario?: ViewScenario;
}): Promise<AdapterResult<BacktestingData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildBacktestingFixture } = await import("../fixtures/backtesting.fixture");
    return buildBacktestingFixture({
      runId: params.runId,
      scenario: params.scenario,
    });
  }

  try {
    const [{ backendFetch, BackendError }, { getPortfolios, getCatalogAssets }] = await Promise.all([
      import("@/lib/backend"),
      import("@/lib/portfolios"),
    ]);

    const [portfolios, catalog] = await Promise.all([
      getPortfolios(params.actorId),
      getCatalogAssets(params.actorId),
    ]);

    if (portfolios.length === 0) {
      return {
        status: "empty",
        title: "Sin carteras para evaluar",
        message:
          "Crea una cartera multiactivo primero para calibrar estrategias y probar su desempeño histórico fuera de muestra.",
        actionLabel: "Ir a Mis carteras",
        actionHref: "/app/carteras",
      };
    }

    const selected = params.portfolioId
      ? portfolios.find((p) => p.id === params.portfolioId) ?? null
      : portfolios[0];

    if (!selected) {
      return {
        status: "empty",
        title: "Cartera no encontrada",
        message: "La cartera solicitada no existe o pertenece a otro usuario.",
        actionLabel: "Volver a Mis carteras",
        actionHref: "/app/carteras",
      };
    }

    let runs: BacktestRunRecord[];
    try {
      const response = await backendFetch<{ backtests: BackendBacktestRun[] }>(
        `/api/internal/portfolios/${encodeURIComponent(selected.id)}/backtests`,
        { actorId: params.actorId },
      );
      runs = response.backtests.map(mapBacktestRun);
    } catch (error) {
      if (error instanceof BackendError && error.status === 404) {
        return {
          status: "empty",
          title: "Cartera no encontrada",
          message: "La cartera solicitada ya no existe o pertenece a otro usuario.",
          actionLabel: "Volver a Mis carteras",
          actionHref: "/app/carteras",
        };
      }
      throw error;
    }

    const activeRun =
      (params.runId ? runs.find((item) => item.id === params.runId) : undefined) ?? runs[0] ?? null;

    const benchmarks = [
      { id: null, symbol: "NONE", label: "Sin benchmark (solo estrategia)" },
      ...catalog.map((asset) => ({
        id: asset.id,
        symbol: asset.symbol,
        label: `${asset.symbol} · ${asset.name} (${asset.currency.trim()})`,
      })),
    ];

    return {
      status: "ok",
      data: {
        portfolioId: selected.id,
        portfolioName: selected.name,
        portfolioCurrency: selected.currency.trim(),
        availablePortfolios: portfolios.map((p) => ({
          id: p.id,
          name: p.name,
          currency: p.currency.trim(),
        })),
        strategies: STRATEGY_OPTIONS,
        benchmarks,
        runs,
        activeRunId: activeRun?.id ?? null,
      },
      provenance: {
        origin: "api",
        freshness: "fresh",
        isExample: false,
        calculatedAt: activeRun
          ? activeRun.executedAt.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        effectiveRange: activeRun?.evaluationWindow
          ? {
              from: activeRun.evaluationWindow.from,
              to: activeRun.evaluationWindow.to,
              observations: activeRun.evaluationWindow.observations,
            }
          : undefined,
        assumptions: activeRun
          ? `Versión v${activeRun.portfolioVersion ?? "?"} (${activeRun.currency ?? selected.currency.trim()}) · ${activeRun.model ?? "fixed_target_rebalance_v1"} · no modifica los pesos de la cartera`
          : "Sin ejecuciones previas en esta cartera · las ventanas de configuración y evaluación son estrictamente disjuntas",
      },
    };
  } catch (error) {
    const common = mapCommonBackendFailure<BacktestingData>(
      error,
      "Motor de backtesting temporalmente no disponible",
      "No fue posible conectar con el servicio de backtesting en Julia.",
    );
    if (common) return common;
    return {
      status: "unavailable",
      title: "Motor de backtesting temporalmente no disponible",
      message: "Ocurrió un error inesperado al cargar el módulo de backtesting.",
    };
  }
}

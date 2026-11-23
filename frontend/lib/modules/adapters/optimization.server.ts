import "server-only";
import {
  isLocalFixturesEnabled,
  mapCommonBackendFailure,
  type AdapterResult,
  type ValidationIssue,
  type ViewScenario,
} from "../runtime";
import type {
  OptimizationData,
  OptimizationObjective,
  OptimizationPortfolioStats,
  OptimizationRunRecord,
  OptimizationWeightRow,
} from "../types";

interface BackendOptimizationWeight {
  asset_id: number;
  symbol: string;
  name: string;
  market: string;
  asset_currency: string;
  manual_weight: number;
  optimized_weight: number;
  min_weight: number;
  max_weight: number;
}

interface BackendOptimizationStats {
  expected_annual_return: number;
  annualized_volatility: number;
  sharpe_ratio: number | null;
}

interface BackendOptimizationRun {
  id: string;
  created_at: string;
  portfolio_id: string;
  portfolio_version: number;
  portfolio_name: string;
  capital: number;
  currency: string;
  start_date: string;
  objective: OptimizationObjective;
  objective_value: number;
  return_model: string;
  periods_per_year: number;
  risk_free_rate: number;
  lookback_years: number;
  max_volatility: number | null;
  feasible_min_volatility: number;
  window: { from: string; to: string };
  observations: number;
  weights: BackendOptimizationWeight[];
  manual_stats: BackendOptimizationStats;
  optimized_stats: BackendOptimizationStats;
  solver: string;
  solver_wrapper_version: string;
}

export interface OptimizationBoundInput {
  assetId: number;
  minWeight: number;
  maxWeight: number;
}

export type OptimizationExecuteResult =
  | { ok: true; run: OptimizationRunRecord }
  | {
      ok: false;
      kind:
        | "infeasible"
        | "validation"
        | "insufficient_data"
        | "undefined_sharpe"
        | "unavailable"
        | "forbidden"
        | "not_found";
      title: string;
      message: string;
      conflicts?: string[];
      minimumVolatility?: number | null;
      reason?: string | null;
      issues?: ValidationIssue[];
    };

function mapStats(raw: BackendOptimizationStats): OptimizationPortfolioStats {
  return {
    expectedAnnualReturn: raw.expected_annual_return,
    annualizedVolatility: raw.annualized_volatility,
    sharpeRatio: raw.sharpe_ratio,
  };
}

function mapOptimizationRun(raw: BackendOptimizationRun): OptimizationRunRecord {
  return {
    id: raw.id,
    createdAt: raw.created_at,
    portfolioId: raw.portfolio_id,
    portfolioVersion: raw.portfolio_version,
    portfolioName: raw.portfolio_name,
    capital: raw.capital,
    currency: raw.currency.trim(),
    startDate: raw.start_date,
    objective: raw.objective,
    objectiveValue: raw.objective_value,
    returnModel: raw.return_model,
    periodsPerYear: raw.periods_per_year,
    riskFreeRate: raw.risk_free_rate,
    lookbackYears: raw.lookback_years,
    maxVolatilityCap: raw.max_volatility,
    feasibleMinVolatility: raw.feasible_min_volatility,
    window: { from: raw.window.from, to: raw.window.to },
    observations: raw.observations,
    weights: raw.weights.map((row) => ({
      assetId: row.asset_id,
      symbol: row.symbol,
      name: row.name,
      market: row.market,
      assetCurrency: row.asset_currency.trim(),
      manualWeight: row.manual_weight,
      optimizedWeight: row.optimized_weight,
      minWeight: row.min_weight,
      maxWeight: row.max_weight,
    })),
    manualStats: mapStats(raw.manual_stats),
    optimizedStats: mapStats(raw.optimized_stats),
    solver: raw.solver,
    solverWrapperVersion: raw.solver_wrapper_version,
  };
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)} %`;
}

function buildInfeasibleConflicts(
  reason: string | null,
  minimumVolatility: number | null,
  requestedCap: number | null,
): string[] {
  if (reason === "volatility_cap_below_minimum") {
    const conflicts: string[] = [];
    if (minimumVolatility !== null) {
      const capLabel = requestedCap !== null ? formatPct(requestedCap) : "el valor indicado";
      conflicts.push(
        `El tope de volatilidad solicitado (${capLabel}) está por debajo de la volatilidad mínima alcanzable con estas cotas: ${formatPct(minimumVolatility)}.`,
      );
      conflicts.push(
        `Aumenta el tope a por lo menos ${formatPct(minimumVolatility)} o amplía los límites mínimo/máximo por activo.`,
      );
    } else {
      conflicts.push("El tope de volatilidad solicitado es menor a la volatilidad mínima alcanzable.");
    }
    return conflicts;
  }
  if (reason === "minimum_weights_exceed_one") {
    return ["La suma de los límites mínimos por activo supera el 100 % disponible."];
  }
  if (reason === "maximum_weights_below_one") {
    return ["La suma de los límites máximos por activo no alcanza el 100 % requerido."];
  }
  if (minimumVolatility !== null) {
    return [
      `No existe una cartera factible con estas restricciones. Volatilidad mínima alcanzable reportada por la API: ${formatPct(minimumVolatility)}.`,
    ];
  }
  return ["No existe una combinación de pesos que cumpla simultáneamente todas las restricciones y sume 100 %."];
}

export async function executePortfolioOptimization(params: {
  actorId: string;
  portfolioId: string;
  objective: OptimizationObjective;
  bounds: OptimizationBoundInput[];
  lookbackYears?: number;
  riskFreeRate?: number;
  maxVolatility?: number | null;
}): Promise<OptimizationExecuteResult> {
  const lookbackYears = params.lookbackYears ?? 5;
  const riskFreeRate = params.riskFreeRate ?? 0;
  const maxVolatility = params.maxVolatility ?? null;

  const issues: ValidationIssue[] = [];
  if (params.objective !== "min_variance" && params.objective !== "max_sharpe") {
    issues.push({ field: "opt-config-title", message: "Elige mínima varianza o máximo ratio Sharpe." });
  }
  if (!Number.isInteger(lookbackYears) || lookbackYears < 1 || lookbackYears > 20) {
    issues.push({ field: "opt-lookback", message: "La ventana histórica debe ser un entero entre 1 y 20 años." });
  }
  if (!Number.isFinite(riskFreeRate) || riskFreeRate < -1 || riskFreeRate > 1) {
    issues.push({
      field: "opt-rf-rate",
      message: "La tasa libre de riesgo anual debe estar entre -100 % y +100 %.",
    });
  }
  if (maxVolatility !== null && (!Number.isFinite(maxVolatility) || maxVolatility < 0)) {
    issues.push({
      field: "opt-max-vol",
      message: "El tope opcional de volatilidad anual debe ser un número mayor o igual a 0 %.",
    });
  }

  const seenAssets = new Set<number>();
  for (const bound of params.bounds) {
    if (!Number.isInteger(bound.assetId) || bound.assetId <= 0 || seenAssets.has(bound.assetId)) {
      issues.push({ field: "opt-bounds-table", message: "Cada activo de la cartera puede aparecer una sola vez en las cotas." });
      break;
    }
    seenAssets.add(bound.assetId);
    if (
      !Number.isFinite(bound.minWeight) ||
      !Number.isFinite(bound.maxWeight) ||
      bound.minWeight < 0 ||
      bound.maxWeight > 1 ||
      bound.minWeight > bound.maxWeight
    ) {
      issues.push({
        field: "opt-bounds-table",
        message: "Las cotas de cada activo deben cumplir 0 % <= mínimo <= máximo <= 100 %.",
      });
      break;
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      kind: "validation",
      title: "Revisa los parámetros de optimización",
      message: "Corrige los campos señalados antes de ejecutar el solver.",
      issues,
    };
  }

  try {
    const { backendFetch, BackendError } = await import("@/lib/backend");
    const body: {
      objective: OptimizationObjective;
      bounds: { asset_id: number; min_weight: number; max_weight: number }[];
      lookback_years: number;
      risk_free_rate: number;
      max_volatility?: number;
    } = {
      objective: params.objective,
      bounds: params.bounds.map((b) => ({
        asset_id: b.assetId,
        min_weight: b.minWeight,
        max_weight: b.maxWeight,
      })),
      lookback_years: lookbackYears,
      risk_free_rate: riskFreeRate,
    };
    if (maxVolatility !== null) {
      body.max_volatility = maxVolatility;
    }

    try {
      const saved = await backendFetch<BackendOptimizationRun>(
        `/api/internal/portfolios/${encodeURIComponent(params.portfolioId)}/optimizations`,
        {
          method: "POST",
          actorId: params.actorId,
          body,
        },
      );
      return { ok: true, run: mapOptimizationRun(saved) };
    } catch (error) {
      if (error instanceof BackendError) {
        if (error.status === 422 && error.code === "optimization_infeasible") {
          const nested = error.details?.details as
            | { reason?: unknown; minimum_volatility?: unknown }
            | undefined;
          const reason = typeof nested?.reason === "string" ? nested.reason : null;
          const minimumVolatility =
            typeof nested?.minimum_volatility === "number" && Number.isFinite(nested.minimum_volatility)
              ? nested.minimum_volatility
              : null;
          return {
            ok: false,
            kind: "infeasible",
            title: "No existe una solución factible con estas restricciones (RF-39)",
            message:
              minimumVolatility !== null
                ? `El solver determinó que la volatilidad mínima alcanzable para estas cotas es ${formatPct(minimumVolatility)}.`
                : "Las cotas ingresadas no permiten construir una cartera que sume 100 %.",
            conflicts: buildInfeasibleConflicts(reason, minimumVolatility, maxVolatility),
            minimumVolatility,
            reason,
          };
        }
        if (error.status === 422 && error.code === "insufficient_data") {
          return {
            ok: false,
            kind: "insufficient_data",
            title: "Histórico insuficiente para optimizar",
            message:
              "Los activos de esta cartera no cuentan con al menos 60 cierres comunes en la ventana histórica solicitada.",
          };
        }
        if (error.status === 422 && error.code === "missing_exchange_rate") {
          return {
            ok: false,
            kind: "unavailable",
            title: "Falta tipo de cambio para valuar la cartera",
            message:
              "Esta cartera tiene activos en otra moneda y falta el tipo de cambio necesario para convertir sus precios.",
          };
        }
        if (error.status === 422 && error.code === "undefined_sharpe") {
          return {
            ok: false,
            kind: "undefined_sharpe",
            title: "Ratio Sharpe no definido",
            message:
              "No hay volatilidad utilizable en los activos o dentro del rango factible para calcular el máximo ratio Sharpe.",
          };
        }
        if (error.status === 400) {
          return {
            ok: false,
            kind: "validation",
            title: "Parámetros rechazados por la API",
            message: error.message,
            issues: [{ field: "opt-max-vol", message: error.message }],
          };
        }
        if (error.status === 404) {
          return {
            ok: false,
            kind: "not_found",
            title: "Cartera no encontrada",
            message: "La cartera seleccionada ya no existe o pertenece a otro usuario.",
          };
        }
        if (error.status === 401 || error.status === 403) {
          return {
            ok: false,
            kind: "forbidden",
            title: "Acceso no autorizado",
            message: "Tu sesión actual no tiene permisos para optimizar esta cartera.",
          };
        }
        if (error.code === "optimization_unavailable") {
          return {
            ok: false,
            kind: "unavailable",
            title: "El solver no pudo certificar una solución",
            message:
              "HiGHS agotó el tiempo límite o no pudo certificar optimalidad para este conjunto de restricciones. Intenta relajar los límites o ajustar la ventana.",
          };
        }
      }
      throw error;
    }
  } catch (error) {
    const common = mapCommonBackendFailure(
      error,
      "Optimizador temporalmente no disponible",
      "No fue posible conectar con el servicio de optimización en Julia.",
    );
    if (common && common.status === "forbidden") {
      return { ok: false, kind: "forbidden", title: common.title, message: common.message };
    }
    return {
      ok: false,
      kind: "unavailable",
      title: "Optimizador temporalmente no disponible",
      message: "No fue posible conectar con el servicio de optimización en Julia.",
    };
  }
}

export async function loadOptimizationView(params: {
  actorId: string;
  portfolioId?: string;
  runId?: string;
  objective?: OptimizationObjective;
  maxVolatilityCap?: number | null;
  scenario?: ViewScenario;
}): Promise<AdapterResult<OptimizationData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildOptimizationFixture } = await import("../fixtures/optimization.fixture");
    return buildOptimizationFixture({
      objective: params.objective,
      maxVolatilityCap: params.maxVolatilityCap,
      scenario: params.scenario,
    });
  }

  try {
    const [{ backendFetch, BackendError }, { getPortfolios }] = await Promise.all([
      import("@/lib/backend"),
      import("@/lib/portfolios"),
    ]);

    const portfolios = await getPortfolios(params.actorId);
    if (portfolios.length === 0) {
      return {
        status: "empty",
        title: "Sin carteras para optimizar",
        message: "Crea una cartera con activos del catálogo para calcular asignaciones de mínima varianza o máximo Sharpe.",
        actionLabel: "Crear cartera",
        actionHref: "/app/carteras/nueva",
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

    let history: OptimizationRunRecord[];
    try {
      const response = await backendFetch<{ optimizations: BackendOptimizationRun[] }>(
        `/api/internal/portfolios/${encodeURIComponent(selected.id)}/optimizations`,
        { actorId: params.actorId },
      );
      history = response.optimizations.map(mapOptimizationRun);
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
      (params.runId ? history.find((item) => item.id === params.runId) : undefined) ?? history[0] ?? null;

    const weights: OptimizationWeightRow[] = activeRun
      ? activeRun.weights
      : selected.positions.map((pos) => ({
          assetId: pos.asset_id,
          symbol: pos.symbol,
          name: pos.name,
          market: pos.market,
          assetCurrency: pos.currency.trim(),
          manualWeight: pos.weight,
          optimizedWeight: pos.weight,
          minWeight: 0,
          maxWeight: 1,
        }));

    const availablePortfolios = portfolios.map((p) => ({
      id: p.id,
      name: p.name,
      currency: p.currency.trim(),
      positions: p.positions.map((pos) => ({
        assetId: pos.asset_id,
        symbol: pos.symbol,
        name: pos.name,
        manualWeight: pos.weight,
      })),
    }));

    const objective: OptimizationObjective = params.objective ?? activeRun?.objective ?? "min_variance";

    return {
      status: "ok",
      data: {
        portfolioId: selected.id,
        portfolioName: selected.name,
        currency: selected.currency.trim(),
        availablePortfolios,
        objective,
        frequencyLabel: activeRun
          ? `Rendimientos diarios anualizados (${activeRun.periodsPerYear} días/año · ${activeRun.solver})`
          : "Rendimientos diarios anualizados (252 días/año · HiGHS)",
        riskFreeRate: activeRun?.riskFreeRate ?? 0,
        lookbackYears: activeRun?.lookbackYears ?? 5,
        maxVolatilityCap: activeRun?.maxVolatilityCap ?? null,
        feasibleMinVolatility: activeRun?.feasibleMinVolatility ?? null,
        weights,
        manualStats: activeRun?.manualStats ?? null,
        optimizedStats: activeRun?.optimizedStats ?? null,
        activeRun,
        history,
      },
      provenance: {
        origin: "api",
        freshness: "fresh",
        isExample: false,
        calculatedAt: activeRun ? activeRun.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        effectiveRange: activeRun
          ? {
              from: activeRun.window.from,
              to: activeRun.window.to,
              observations: activeRun.observations,
            }
          : undefined,
        assumptions: activeRun
          ? `Versión v${activeRun.portfolioVersion} · ${activeRun.solver} ${activeRun.solverWrapperVersion} · tasa libre ${(activeRun.riskFreeRate * 100).toFixed(2)} % · no modifica los pesos de la cartera ni constituye recomendación financiera`
          : "Sin ejecuciones previas en esta cartera · el cálculo usa HiGHS en Julia y nunca modifica los pesos guardados",
      },
    };
  } catch (error) {
    const common = mapCommonBackendFailure<OptimizationData>(
      error,
      "Optimizador temporalmente no disponible",
      "No fue posible conectar con el servicio de optimización en Julia.",
    );
    if (common) return common;
    return {
      status: "unavailable",
      title: "Optimizador temporalmente no disponible",
      message: "Ocurrió un error inesperado al cargar el módulo de optimización.",
    };
  }
}
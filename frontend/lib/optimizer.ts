import {
  type PortfolioAsset,
  type PortfolioMetrics,
  portfolioMetrics,
} from "./portfolios";
import { SAMPLE_ASSETS, SAMPLE_CORRELATION } from "./landing-data";

export type OptimizationObjective = "min_variance" | "max_sharpe";

export interface OptimizationConstraints {
  /** Peso mínimo por activo como porcentaje (ej. 0 o 5) */
  minWeight: number;
  /** Peso máximo por activo como porcentaje (ej. 40 o 100) */
  maxWeight: number;
  /** Tasa libre de riesgo anual para el ratio de Sharpe (por defecto 0.045 = 4.5 %) */
  riskFreeRate?: number;
}

export interface OptimizationResult {
  weights: number[]; // Porcentajes de 0 a 100 que suman 100
  assets: PortfolioAsset[];
  metrics: PortfolioMetrics;
  objective: OptimizationObjective;
  objectiveValue: number;
  elapsedMs: number;
}

export interface EfficientFrontierPoint {
  volatility: number; // sigma anual
  returnRate: number; // mu anual
  sharpe: number;
  weights: number[];
}

/** Obtiene la correlación entre dos tickers según SAMPLE_CORRELATION o defecto */
export function getCorrelation(tickerA: string, tickerB: string): number {
  const idxA = SAMPLE_ASSETS.findIndex((a) => a.ticker === tickerA);
  const idxB = SAMPLE_ASSETS.findIndex((a) => a.ticker === tickerB);
  if (idxA !== -1 && idxB !== -1) {
    return SAMPLE_CORRELATION[idxA][idxB];
  }
  return tickerA === tickerB ? 1.0 : 0.35;
}

function getAssetReturn(ticker: string): number {
  const sample = SAMPLE_ASSETS.find((a) => a.ticker === ticker);
  return sample?.annualReturn ?? 0.15;
}

function getAssetVol(ticker: string): number {
  const sample = SAMPLE_ASSETS.find((a) => a.ticker === ticker);
  return sample?.annualVolatility ?? 0.22;
}

/**
 * Proyección euclídea exacta sobre el símplex con cotas [lower, upper].
 * Resuelve: min_w 0.5 * ||w - v||^2  s.a. sum(w) = targetSum, lower_i <= w_i <= upper_i.
 * Método de bisección sobre el multiplicador de Lagrange. Complejidad O(n * 50) < 0.001 ms.
 */
export function projectBoundedSimplex(
  v: number[],
  lower: number[],
  upper: number[],
  targetSum = 1.0,
): number[] {
  const n = v.length;
  let lambdaMin = Infinity;
  let lambdaMax = -Infinity;

  for (let i = 0; i < n; i++) {
    lambdaMin = Math.min(lambdaMin, v[i] - upper[i]);
    lambdaMax = Math.max(lambdaMax, v[i] - lower[i]);
  }

  if (lambdaMax <= lambdaMin) {
    lambdaMax = lambdaMin + 1.0;
  }

  // 55 iteraciones de bisección garantizan precisión de máquina (~1e-16)
  for (let iter = 0; iter < 55; iter++) {
    const lambdaMid = (lambdaMin + lambdaMax) / 2;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const val = v[i] - lambdaMid;
      sum += Math.min(upper[i], Math.max(lower[i], val));
    }
    if (sum > targetSum) {
      lambdaMin = lambdaMid;
    } else {
      lambdaMax = lambdaMid;
    }
  }

  const lambdaOpt = (lambdaMin + lambdaMax) / 2;
  const result = new Array<number>(n);
  let finalSum = 0;

  for (let i = 0; i < n; i++) {
    const val = Math.min(upper[i], Math.max(lower[i], v[i] - lambdaOpt));
    result[i] = val;
    finalSum += val;
  }

  // Pequeño ajuste por redondeo numérico flotante
  if (Math.abs(finalSum - targetSum) > 1e-9 && finalSum > 0) {
    const factor = targetSum / finalSum;
    for (let i = 0; i < n; i++) {
      result[i] = Math.min(upper[i], Math.max(lower[i], result[i] * factor));
    }
  }

  return result;
}

/**
 * Construye la matriz de covarianza anualizada a partir de los activos seleccionados.
 */
export function buildCovarianceMatrix(assets: PortfolioAsset[]): number[][] {
  const n = assets.length;
  const cov: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    const volI = getAssetVol(assets[i].ticker);
    for (let j = 0; j < n; j++) {
      const volJ = getAssetVol(assets[j].ticker);
      const rho = getCorrelation(assets[i].ticker, assets[j].ticker);
      cov[i][j] = rho * volI * volJ;
    }
  }
  return cov;
}

/**
 * Valida la factibilidad de las restricciones (RF-39).
 * Si la suma de pesos mínimos es > 100 % o la suma de máximos es < 100 %, no hay solución.
 */
export function validateConstraintsFeasibility(
  assetCount: number,
  constraints: OptimizationConstraints,
): { feasible: boolean; error?: string } {
  if (assetCount === 0) {
    return { feasible: false, error: "Selecciona al menos un activo para optimizar." };
  }

  const minTotal = (constraints.minWeight * assetCount) / 100;
  const maxTotal = (constraints.maxWeight * assetCount) / 100;

  if (constraints.minWeight < 0) {
    return { feasible: false, error: "El peso mínimo no puede ser negativo (sin ventas en corto)." };
  }
  if (constraints.maxWeight > 100) {
    return { feasible: false, error: "El peso máximo no puede superar el 100 %." };
  }
  if (constraints.minWeight > constraints.maxWeight) {
    return {
      feasible: false,
      error: `El peso mínimo (${constraints.minWeight} %) supera al máximo (${constraints.maxWeight} %).`,
    };
  }
  if (minTotal > 1.0001) {
    return {
      feasible: false,
      error: `La suma de pesos mínimos (${constraints.minWeight} % × ${assetCount} activos = ${(minTotal * 100).toFixed(0)} %) supera el 100 %. Reduce el límite mínimo.`,
    };
  }
  if (maxTotal < 0.9999) {
    return {
      feasible: false,
      error: `La suma de pesos máximos (${constraints.maxWeight} % × ${assetCount} activos = ${(maxTotal * 100).toFixed(0)} %) es menor al 100 %. Aumenta el límite máximo.`,
    };
  }

  return { feasible: true };
}

/**
 * Motor de optimización de carteras según la teoría de Markowitz (RF-34, RF-35, RF-38).
 */
export function optimizePortfolio(
  sourceAssets: PortfolioAsset[],
  objective: OptimizationObjective,
  constraints: OptimizationConstraints,
): OptimizationResult {
  const startTime = performance.now();
  const n = sourceAssets.length;
  const rf = constraints.riskFreeRate ?? 0.045;

  // Validación de factibilidad
  const feasibility = validateConstraintsFeasibility(n, constraints);
  if (!feasibility.feasible) {
    throw new Error(feasibility.error ?? "Restricciones no factibles.");
  }

  const lower = new Array(n).fill(constraints.minWeight / 100);
  const upper = new Array(n).fill(constraints.maxWeight / 100);
  const cov = buildCovarianceMatrix(sourceAssets);
  const mu = sourceAssets.map((a) => getAssetReturn(a.ticker));

  // Funciones auxiliares de cálculo
  function portfolioVar(w: number[]): number {
    let variance = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += w[i] * w[j] * cov[i][j];
      }
    }
    return Math.max(1e-12, variance);
  }

  function portfolioRet(w: number[]): number {
    let ret = 0;
    for (let i = 0; i < n; i++) ret += w[i] * mu[i];
    return ret;
  }

  function portfolioSharpe(w: number[]): number {
    const v = portfolioVar(w);
    const s = Math.sqrt(v);
    return s > 0 ? (portfolioRet(w) - rf) / s : 0;
  }

  let optimalWeights: number[];

  if (objective === "min_variance") {
    // Minimizar f(w) = 0.5 * w^T Cov w
    let w = projectBoundedSimplex(new Array(n).fill(1 / n), lower, upper);
    let step = 0.5;

    for (let iter = 0; iter < 150; iter++) {
      const grad = new Array<number>(n);
      for (let i = 0; i < n; i++) {
        let g = 0;
        for (let j = 0; j < n; j++) g += cov[i][j] * w[j];
        grad[i] = g;
      }

      // Proyección con gradiente descendente
      const unprojected = w.map((wi, i) => wi - step * grad[i]);
      const wNext = projectBoundedSimplex(unprojected, lower, upper);

      const fCurr = portfolioVar(w);
      const fNext = portfolioVar(wNext);

      // Backtracking adaptativo
      if (fNext < fCurr) {
        w = wNext;
        step = Math.min(step * 1.05, 2.0);
      } else {
        step = Math.max(step * 0.5, 1e-6);
      }

      // Criterio de parada
      let diff = 0;
      for (let i = 0; i < n; i++) diff += Math.abs(wNext[i] - w[i]);
      if (diff < 1e-7 && iter > 15) break;
    }
    optimalWeights = w;
  } else {
    // Maximizar Ratio de Sharpe (RF-35)
    // Múltiples inicios para evitar óptimos locales
    const candidates: number[][] = [];

    // Inicio 1: Partes iguales
    candidates.push(projectBoundedSimplex(new Array(n).fill(1 / n), lower, upper));

    // Inicio 2: Cartera de mínima varianza
    const minVarRes = optimizePortfolio(sourceAssets, "min_variance", constraints);
    candidates.push(minVarRes.weights.map((w) => w / 100));

    // Inicio 3: Favorecer activos con mayor Sharpe individual
    const singleSharpes = sourceAssets.map((a) => {
      const ret = getAssetReturn(a.ticker);
      const vol = getAssetVol(a.ticker);
      return (ret - rf) / vol;
    });
    const sharpeVector = singleSharpes.map((s) => Math.max(0, s));
    const sumS = sharpeVector.reduce((a, b) => a + b, 0) || 1;
    candidates.push(projectBoundedSimplex(sharpeVector.map((s) => s / sumS), lower, upper));

    let bestW = candidates[0];
    let bestSharpe = portfolioSharpe(bestW);

    for (const startW of candidates) {
      let w = [...startW];
      let step = 0.05;

      for (let iter = 0; iter < 120; iter++) {
        const v = portfolioVar(w);
        const s = Math.sqrt(v);
        const r = portfolioRet(w);
        const excess = r - rf;

        // Gradiente analítico del ratio de Sharpe:
        const grad = new Array<number>(n);
        for (let i = 0; i < n; i++) {
          let covW = 0;
          for (let j = 0; j < n; j++) covW += cov[i][j] * w[j];
          grad[i] = mu[i] / s - (excess / (v * s)) * covW;
        }

        const unprojected = w.map((wi, i) => wi + step * grad[i]);
        const wNext = projectBoundedSimplex(unprojected, lower, upper);

        const nextSharpe = portfolioSharpe(wNext);
        if (nextSharpe > portfolioSharpe(w)) {
          w = wNext;
          step = Math.min(step * 1.05, 0.5);
        } else {
          step = Math.max(step * 0.5, 1e-5);
        }
      }

      const candidateSharpe = portfolioSharpe(w);
      if (candidateSharpe > bestSharpe) {
        bestSharpe = candidateSharpe;
        bestW = w;
      }
    }

    optimalWeights = bestW;
  }

  // Redondear porcentajes a 1 decimal asegurando suma de exactamente 100 %
  const percentages = optimalWeights.map((w) => Math.round(w * 1000) / 10);
  const sumP = percentages.reduce((a, b) => a + b, 0);
  if (Math.abs(sumP - 100) > 0.001) {
    const diff = 100 - sumP;
    let maxIdx = 0;
    for (let i = 1; i < n; i++) {
      if (percentages[i] > percentages[maxIdx]) maxIdx = i;
    }
    percentages[maxIdx] = Math.round((percentages[maxIdx] + diff) * 10) / 10;
  }

  const resultAssets: PortfolioAsset[] = sourceAssets.map((asset, i) => ({
    ticker: asset.ticker,
    weight: percentages[i],
  }));

  const metrics = portfolioMetrics(resultAssets, rf)!;
  const elapsedMs = performance.now() - startTime;

  return {
    weights: percentages,
    assets: resultAssets,
    metrics,
    objective,
    objectiveValue:
      objective === "min_variance" ? metrics.annualVolatility : metrics.sharpeRatio,
    elapsedMs,
  };
}

/**
 * Calcula la Frontera Eficiente de Markowitz para graficar el conjunto de carteras óptimas.
 */
export function computeEfficientFrontier(
  assets: PortfolioAsset[],
  pointCount = 20,
): EfficientFrontierPoint[] {
  if (assets.length < 2) return [];

  const baseConstraints: OptimizationConstraints = {
    minWeight: 0,
    maxWeight: 100,
    riskFreeRate: 0.045,
  };

  const minVar = optimizePortfolio(assets, "min_variance", baseConstraints);
  const returns = assets.map((a) => getAssetReturn(a.ticker));
  const minRet = minVar.metrics.annualReturn;
  const maxRet = Math.max(...returns);

  const points: EfficientFrontierPoint[] = [];
  const stepRet = (maxRet - minRet) / Math.max(1, pointCount - 1);
  const n = assets.length;
  const cov = buildCovarianceMatrix(assets);
  const lower = new Array(n).fill(0);
  const upper = new Array(n).fill(1);

  for (let step = 0; step < pointCount; step++) {
    const targetRet = minRet + step * stepRet;

    let w = projectBoundedSimplex(new Array(n).fill(1 / n), lower, upper);
    let gamma = 50.0;
    let alpha = 0.2;

    for (let iter = 0; iter < 100; iter++) {
      let curRet = 0;
      for (let i = 0; i < n; i++) curRet += w[i] * returns[i];
      const retDeficit = Math.max(0, targetRet - curRet);

      const grad = new Array<number>(n);
      for (let i = 0; i < n; i++) {
        let covPart = 0;
        for (let j = 0; j < n; j++) covPart += cov[i][j] * w[j];
        grad[i] = covPart - gamma * retDeficit * returns[i];
      }

      const unproj = w.map((wi, i) => wi - alpha * grad[i]);
      w = projectBoundedSimplex(unproj, lower, upper);
    }

    const ptAssets = assets.map((a, i) => ({ ticker: a.ticker, weight: w[i] * 100 }));
    const m = portfolioMetrics(ptAssets, 0.045);
    if (m) {
      points.push({
        volatility: m.annualVolatility,
        returnRate: m.annualReturn,
        sharpe: m.sharpeRatio,
        weights: w.map((v) => Math.round(v * 100)),
      });
    }
  }

  points.sort((a, b) => a.volatility - b.volatility);
  return points;
}

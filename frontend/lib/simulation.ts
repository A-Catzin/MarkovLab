// Versión para el navegador del modelo del backend `normal-rebalanced-v1`
// (backend/src/domain/simulation.jl): el rendimiento de la cartera por período es
// normal con mu_p = w'mu y sigma_p = sqrt(w' Sigma w); cada escenario capitaliza
// `horizon` períodos. Los cuantiles usan interpolación lineal (tipo 7 de Hyndman y Fan),
// y el VaR y el CVaR se informan como pérdidas positivas.
//
// La secuencia aleatoria (mulberry32 + Box-Muller) es distinta de la de Xoshiro en Julia,
// así que los resultados coinciden con el backend en distribución, no número por número.

export const TRADING_DAYS = 252;
export const SUMMARY_PERCENTILES = [1, 5, 25, 50, 75, 95, 99] as const;

export interface SampleAsset {
  ticker: string;
  name: string;
  annualReturn: number;
  annualVolatility: number;
}

export interface SimulationSummary {
  scenarios: number;
  mean: number;
  worst: number;
  best: number;
  percentiles: Record<(typeof SUMMARY_PERCENTILES)[number], number>;
  confidence: number;
  valueAtRisk: number;
  conditionalValueAtRisk: number;
}

export interface SimulationRequest {
  weights: number[];
  horizon: number;
  simulations: number;
  seed: number;
  confidence: number;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalGenerator(seed: number): () => number {
  const uniform = mulberry32(seed);
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const u = 1 - uniform();
    const v = uniform();
    const radius = Math.sqrt(-2 * Math.log(u));
    spare = radius * Math.sin(2 * Math.PI * v);
    return radius * Math.cos(2 * Math.PI * v);
  };
}

/** Media y volatilidad diarias de la cartera a partir de las cifras anuales de ejemplo. */
export function portfolioMoments(
  assets: SampleAsset[],
  correlation: number[][],
  weights: number[],
): { mu: number; sigma: number } {
  const dailyMu = assets.map((a) => a.annualReturn / TRADING_DAYS);
  const dailySigma = assets.map((a) => a.annualVolatility / Math.sqrt(TRADING_DAYS));
  let mu = 0;
  let variance = 0;
  for (let i = 0; i < assets.length; i++) {
    mu += weights[i] * dailyMu[i];
    for (let j = 0; j < assets.length; j++) {
      variance += weights[i] * weights[j] * correlation[i][j] * dailySigma[i] * dailySigma[j];
    }
  }
  return { mu, sigma: Math.sqrt(Math.max(variance, 0)) };
}

export function simulateOutcomes(mu: number, sigma: number, horizon: number, simulations: number, seed: number) {
  const normal = normalGenerator(seed);
  const outcomes = new Float64Array(simulations);
  for (let s = 0; s < simulations; s++) {
    let growth = 1;
    for (let t = 0; t < horizon; t++) growth *= 1 + mu + sigma * normal();
    outcomes[s] = growth - 1;
  }
  return outcomes;
}

/** Cuantil tipo 7 de un arreglo ordenado de menor a mayor. */
export function quantileSorted(sorted: Float64Array, p: number): number {
  const h = (sorted.length - 1) * p;
  const lower = Math.floor(h);
  if (lower >= sorted.length - 1) return sorted[sorted.length - 1];
  return sorted[lower] + (h - lower) * (sorted[lower + 1] - sorted[lower]);
}

export function summarize(outcomes: Float64Array, confidence: number): { summary: SimulationSummary; sorted: Float64Array } {
  const sorted = Float64Array.from(outcomes).sort();
  const threshold = quantileSorted(sorted, 1 - confidence);
  let tailSum = 0;
  let tailCount = 0;
  let total = 0;
  for (const value of sorted) {
    total += value;
    if (value <= threshold) {
      tailSum += value;
      tailCount++;
    }
  }
  const percentiles = Object.fromEntries(
    SUMMARY_PERCENTILES.map((p) => [p, quantileSorted(sorted, p / 100)]),
  ) as SimulationSummary["percentiles"];
  return {
    sorted,
    summary: {
      scenarios: sorted.length,
      mean: total / sorted.length,
      worst: sorted[0],
      best: sorted[sorted.length - 1],
      percentiles,
      confidence,
      valueAtRisk: -threshold,
      conditionalValueAtRisk: -(tailSum / tailCount),
    },
  };
}

export function histogram(sorted: Float64Array, bins: number) {
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  const width = (high - low) / bins || 1;
  const counts = new Array<number>(bins).fill(0);
  for (const value of sorted) counts[Math.min(bins - 1, Math.floor((value - low) / width))]++;
  return { low, high, width, counts };
}

export function runSimulation(assets: SampleAsset[], correlation: number[][], request: SimulationRequest) {
  const weights = request.weights.map((w) => w / 100);
  const { mu, sigma } = portfolioMoments(assets, correlation, weights);
  const outcomes = simulateOutcomes(mu, sigma, request.horizon, request.simulations, request.seed);
  const { summary, sorted } = summarize(outcomes, request.confidence);
  return { mu, sigma, summary, histogram: histogram(sorted, 36) };
}

/** Trayectorias de valor (empiezan en 1) para el gráfico de la portada. */
export function samplePaths(mu: number, sigma: number, horizon: number, count: number, seed: number): number[][] {
  const normal = normalGenerator(seed);
  return Array.from({ length: count }, () => {
    const path = [1];
    for (let t = 0; t < horizon; t++) path.push(path[t] * (1 + mu + sigma * normal()));
    return path;
  });
}

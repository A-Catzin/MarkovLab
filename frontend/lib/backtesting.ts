import { createId, type Currency, type Portfolio } from "./portfolios";
import { SAMPLE_ASSETS, SAMPLE_CORRELATION } from "./landing-data";
import { TRADING_DAYS } from "./simulation";

export type RebalanceFrequency = "monthly" | "quarterly" | "annual" | "buy_and_hold";
export type BacktestHorizon = 252 | 756 | 1260; // 1 año, 3 años, 5 años

export interface BacktestMetrics {
  initialCapital: number;
  finalCapital: number;
  cumulativeReturn: number; // e.g. 0.45 = +45 %
  cagr: number; // Tasa de crecimiento anual compuesto
  annualizedVolatility: number; // sigma anual
  sharpeRatio: number;
  maxDrawdown: number; // e.g. -0.15 = -15 %
  beta: number; // Beta respecto al benchmark
  alpha: number; // Alfa de Jensen
  positiveDaysRatio: number; // Fracción de días con ganancia
}

export interface BacktestSeriesPoint {
  date: string;
  dayIndex: number;
  portfolioValue: number;
  benchmarkValue: number;
  portfolioDrawdown: number;
  benchmarkDrawdown: number;
}

export interface BacktestResult {
  portfolioName: string;
  benchmarkTicker: string;
  horizonDays: number;
  rebalanceFrequency: RebalanceFrequency;
  initialCapital: number;
  currency: Currency;
  seed: number;
  portfolioMetrics: BacktestMetrics;
  benchmarkMetrics: BacktestMetrics;
  series: BacktestSeriesPoint[];
  elapsedMs: number;
}

/** Descomposición de Cholesky L de una matriz definida positiva (A = L * L^T) */
function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const val = matrix[i][i] - sum;
        L[i][j] = Math.sqrt(Math.max(val, 1e-8));
      } else {
        L[i][j] = (matrix[i][j] - sum) / (L[j][j] || 1e-8);
      }
    }
  }
  return L;
}

/** Generador pseudoaleatorio mulberry32 con semilla determinista */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller para variables normales estándar independientes */
function normalGenerator(uniform: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    const u = Math.max(1e-10, uniform());
    const v = uniform();
    const r = Math.sqrt(-2.0 * Math.log(u));
    spare = r * Math.sin(2.0 * Math.PI * v);
    return r * Math.cos(2.0 * Math.PI * v);
  };
}

/** Activos que pueden participar en el backtest con sus rendimientos y volatilidades */
interface AssetProfile {
  ticker: string;
  muDaily: number;
  sigmaDaily: number;
}

function getAssetProfile(ticker: string): AssetProfile {
  const s = SAMPLE_ASSETS.find((a) => a.ticker === ticker);
  const annualReturn = s?.annualReturn ?? 0.15;
  const annualVolatility = s?.annualVolatility ?? 0.22;
  return {
    ticker,
    muDaily: annualReturn / TRADING_DAYS,
    sigmaDaily: annualVolatility / Math.sqrt(TRADING_DAYS),
  };
}

/**
 * Perfiles ilustrativos de los índices de referencia: rendimiento y volatilidad
 * anuales aproximados, y correlación esperada con cada activo de ejemplo.
 */
interface BenchmarkProfile {
  annualReturn: number;
  annualVolatility: number;
  correlations: Record<string, number>;
  defaultCorrelation: number;
}

const BENCHMARK_PROFILES: Record<string, BenchmarkProfile> = {
  // S&P 500 (renta variable de EE. UU.)
  SPY: {
    annualReturn: 0.118,
    annualVolatility: 0.155,
    correlations: { AAPL: 0.82, MSFT: 0.82, JPM: 0.74, XOM: 0.58 },
    defaultCorrelation: 0.7,
  },
  // Renta fija agregada de EE. UU.: menos retorno, mucha menos volatilidad
  // y correlación baja con la renta variable.
  BND: {
    annualReturn: 0.042,
    annualVolatility: 0.055,
    correlations: { AAPL: 0.12, MSFT: 0.12, JPM: 0.22, XOM: 0.08 },
    defaultCorrelation: 0.15,
  },
};

/**
 * Ejecuta un backtest histórico determinista y reproducible (RF-49, RF-50, RF-51, RF-52).
 */
export function runBacktest(params: {
  portfolio: Portfolio;
  benchmarkTicker?: string;
  horizonDays: BacktestHorizon;
  rebalanceFrequency: RebalanceFrequency;
  initialCapital?: number;
  seed?: number;
}): BacktestResult {
  const startTime = performance.now();
  const {
    portfolio,
    benchmarkTicker = "SPY",
    horizonDays,
    rebalanceFrequency,
    initialCapital = portfolio.capital || 10_000,
    seed = 1913, // Año de la memoria de Andréi Márkov
  } = params;

  // Filtrar activos de la cartera con peso positivo
  const activeAssets = portfolio.assets.filter((a) => a.weight > 0);
  const n = activeAssets.length;

  // Normalizar pesos al 100 %
  const totalWeight = activeAssets.reduce((sum, a) => sum + a.weight, 0) || 100;
  const targetWeights = activeAssets.map((a) => a.weight / totalWeight);

  // Perfiles de activos y del índice de referencia
  const assetProfiles = activeAssets.map((a) => getAssetProfile(a.ticker));
  const benchDefinition = BENCHMARK_PROFILES[benchmarkTicker] ?? BENCHMARK_PROFILES.SPY;
  const benchProfile: AssetProfile = {
    ticker: benchmarkTicker,
    muDaily: benchDefinition.annualReturn / TRADING_DAYS,
    sigmaDaily: benchDefinition.annualVolatility / Math.sqrt(TRADING_DAYS),
  };

  // Construir matriz de correlación conjunta (activos + benchmark)
  // Tamaño (n + 1) x (n + 1), donde el último índice es el benchmark
  const m = n + 1;
  const corrMatrix: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const idxA = SAMPLE_ASSETS.findIndex((a) => a.ticker === activeAssets[i].ticker);
      const idxB = SAMPLE_ASSETS.findIndex((a) => a.ticker === activeAssets[j].ticker);
      if (idxA !== -1 && idxB !== -1) {
        corrMatrix[i][j] = SAMPLE_CORRELATION[idxA][idxB];
      } else {
        corrMatrix[i][j] = i === j ? 1.0 : 0.35;
      }
    }
    // Correlación entre el activo i y el índice de referencia
    const ticker = activeAssets[i].ticker;
    const benchCorr = benchDefinition.correlations[ticker] ?? benchDefinition.defaultCorrelation;
    corrMatrix[i][n] = benchCorr;
    corrMatrix[n][i] = benchCorr;
  }
  corrMatrix[n][n] = 1.0;

  // Descomposición de Cholesky para simular choques correlacionados
  const L = choleskyDecomposition(corrMatrix);

  // Generador pseudoaleatorio determinista
  const uniform = mulberry32(seed);
  const nextNormal = normalGenerator(uniform);

  // Variables de seguimiento temporal
  const dates: string[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - Math.round(horizonDays * 1.45)); // Retroceder días calendario

  // Frecuencia de rebalanceo en días bursátiles
  const rebalanceInterval =
    rebalanceFrequency === "monthly"
      ? 21
      : rebalanceFrequency === "quarterly"
        ? 63
        : rebalanceFrequency === "annual"
          ? 252
          : Infinity; // Buy and hold

  // Monto en cada activo
  let assetValues = targetWeights.map((w) => initialCapital * w);
  let benchValue = initialCapital;

  let peakPortValue = initialCapital;
  let peakBenchValue = initialCapital;

  const portDailyReturns: number[] = [];
  const benchDailyReturns: number[] = [];

  const rawSeries: BacktestSeriesPoint[] = [];

  // Punto inicial (día 0)
  rawSeries.push({
    date: baseDate.toISOString().slice(0, 10),
    dayIndex: 0,
    portfolioValue: initialCapital,
    benchmarkValue: initialCapital,
    portfolioDrawdown: 0,
    benchmarkDrawdown: 0,
  });

  let currentDate = new Date(baseDate);

  // Simulación paso a paso a lo largo de los días bursátiles
  for (let day = 1; day <= horizonDays; day++) {
    // Avanzar fecha saltando fines de semana
    currentDate.setDate(currentDate.getDate() + 1);
    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    const dateStr = currentDate.toISOString().slice(0, 10);

    // 1. Generar choques normales estándar independientes
    const zIndep = new Array<number>(m);
    for (let k = 0; k < m; k++) zIndep[k] = nextNormal();

    // 2. Correlacionar choques mediante L
    const zCorr = new Array<number>(m);
    for (let i = 0; i < m; i++) {
      let sum = 0;
      for (let k = 0; k <= i; k++) {
        sum += L[i][k] * zIndep[k];
      }
      zCorr[i] = sum;
    }

    // 3. Aplicar rendimientos diarios a cada activo
    let nextPortValue = 0;
    for (let i = 0; i < n; i++) {
      const ret_i = assetProfiles[i].muDaily + assetProfiles[i].sigmaDaily * zCorr[i];
      assetValues[i] = assetValues[i] * (1.0 + ret_i);
      nextPortValue += assetValues[i];
    }

    // 4. Aplicar rendimiento diario al benchmark
    const benchRet = benchProfile.muDaily + benchProfile.sigmaDaily * zCorr[n];
    const prevBench = benchValue;
    benchValue = benchValue * (1.0 + benchRet);

    // Registrar rendimientos diarios para cálculo de volatilidad y Sharpe
    const portPrev = rawSeries[rawSeries.length - 1].portfolioValue;
    const portDayReturn = (nextPortValue - portPrev) / portPrev;
    portDailyReturns.push(portDayReturn);
    benchDailyReturns.push((benchValue - prevBench) / prevBench);

    // 5. Rebalancear si corresponde
    if (day % rebalanceInterval === 0 && rebalanceInterval !== Infinity) {
      for (let i = 0; i < n; i++) {
        assetValues[i] = nextPortValue * targetWeights[i];
      }
    }

    // 6. Actualizar picos y drawdowns
    if (nextPortValue > peakPortValue) peakPortValue = nextPortValue;
    if (benchValue > peakBenchValue) peakBenchValue = benchValue;

    const portDrawdown = (nextPortValue - peakPortValue) / peakPortValue;
    const benchDrawdown = (benchValue - peakBenchValue) / peakBenchValue;

    rawSeries.push({
      date: dateStr,
      dayIndex: day,
      portfolioValue: nextPortValue,
      benchmarkValue: benchValue,
      portfolioDrawdown: portDrawdown,
      benchmarkDrawdown: benchDrawdown,
    });
  }

  // Muestrear puntos para el gráfico (evitar sobrecargar el DOM con 1200 puntos SVG)
  const targetSamplePoints = 80;
  const step = Math.max(1, Math.floor(rawSeries.length / targetSamplePoints));
  const sampledSeries = rawSeries.filter((_, idx) => idx % step === 0 || idx === rawSeries.length - 1);

  // Calcular métricas finales de la cartera y del benchmark
  const finalPortValue = rawSeries[rawSeries.length - 1].portfolioValue;
  const finalBenchValue = rawSeries[rawSeries.length - 1].benchmarkValue;

  function calcMetrics(
    initial: number,
    final: number,
    dailyReturns: number[],
    drawdowns: number[],
  ): { cumulative: number; cagr: number; vol: number; sharpe: number; mdd: number; winRate: number } {
    const cumulative = (final - initial) / initial;
    const years = horizonDays / TRADING_DAYS;
    const cagr = Math.pow(final / initial, 1 / years) - 1;

    // Media y desviación estándar muestral de rendimientos diarios
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (dailyReturns.length - 1);
    const dailyVol = Math.sqrt(Math.max(1e-10, variance));
    const annualizedVol = dailyVol * Math.sqrt(TRADING_DAYS);

    const rf = 0.045; // Tasa libre de riesgo anual
    const sharpe = annualizedVol > 0 ? (cagr - rf) / annualizedVol : 0;
    const mdd = Math.min(...drawdowns);
    const winRate = dailyReturns.filter((r) => r > 0).length / dailyReturns.length;

    return { cumulative, cagr, vol: annualizedVol, sharpe, mdd, winRate };
  }

  const portDrawdowns = rawSeries.map((p) => p.portfolioDrawdown);
  const benchDrawdowns = rawSeries.map((p) => p.benchmarkDrawdown);

  const pm = calcMetrics(initialCapital, finalPortValue, portDailyReturns, portDrawdowns);
  const bm = calcMetrics(initialCapital, finalBenchValue, benchDailyReturns, benchDrawdowns);

  // Beta de la cartera respecto al benchmark: Cov(Rp, Rb) / Var(Rb)
  let covPb = 0;
  let varB = 0;
  const meanP = portDailyReturns.reduce((a, b) => a + b, 0) / portDailyReturns.length;
  const meanB = benchDailyReturns.reduce((a, b) => a + b, 0) / benchDailyReturns.length;

  for (let k = 0; k < portDailyReturns.length; k++) {
    const diffP = portDailyReturns[k] - meanP;
    const diffB = benchDailyReturns[k] - meanB;
    covPb += diffP * diffB;
    varB += diffB * diffB;
  }
  const beta = varB > 0 ? covPb / varB : 1.0;

  // Alfa de Jensen anualizado: CAGR_p - (rf + beta * (CAGR_b - rf))
  const rf = 0.045;
  const alpha = pm.cagr - (rf + beta * (bm.cagr - rf));

  const portfolioMetrics: BacktestMetrics = {
    initialCapital,
    finalCapital: finalPortValue,
    cumulativeReturn: pm.cumulative,
    cagr: pm.cagr,
    annualizedVolatility: pm.vol,
    sharpeRatio: pm.sharpe,
    maxDrawdown: pm.mdd,
    beta,
    alpha,
    positiveDaysRatio: pm.winRate,
  };

  const benchmarkMetrics: BacktestMetrics = {
    initialCapital,
    finalCapital: finalBenchValue,
    cumulativeReturn: bm.cumulative,
    cagr: bm.cagr,
    annualizedVolatility: bm.vol,
    sharpeRatio: bm.sharpe,
    maxDrawdown: bm.mdd,
    beta: 1.0,
    alpha: 0.0,
    positiveDaysRatio: bm.winRate,
  };

  const elapsedMs = performance.now() - startTime;

  return {
    portfolioName: portfolio.name,
    benchmarkTicker,
    horizonDays,
    rebalanceFrequency,
    initialCapital,
    currency: portfolio.currency,
    seed,
    portfolioMetrics,
    benchmarkMetrics,
    series: sampledSeries,
    elapsedMs,
  };
}

/* ---------- Persistencia provisional de resultados (RF-53) ---------- */

export const BACKTEST_STORAGE_KEY = "markovlab.backtests.v1";
const MAX_SAVED_BACKTESTS = 50;

/** Resultado guardado con sus parámetros, listo para el módulo de historial. */
export interface SavedBacktest extends BacktestResult {
  id: string;
  portfolioId: string;
  /** Fecha y hora ISO del guardado. */
  createdAt: string;
}

function isSavedBacktest(value: unknown): value is SavedBacktest {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.portfolioId === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.portfolioName === "string" &&
    typeof item.initialCapital === "number" &&
    typeof item.portfolioMetrics === "object" &&
    item.portfolioMetrics !== null &&
    typeof item.benchmarkMetrics === "object" &&
    item.benchmarkMetrics !== null &&
    Array.isArray(item.series)
  );
}

export function readBacktests(): SavedBacktest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BACKTEST_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedBacktest);
  } catch {
    return [];
  }
}

/** Guarda un resultado al inicio de la lista y devuelve la lista actualizada. */
export function saveBacktest(result: BacktestResult, portfolioId: string): SavedBacktest[] {
  const record: SavedBacktest = {
    ...result,
    id: createId(),
    portfolioId,
    createdAt: new Date().toISOString(),
  };
  const list = [record, ...readBacktests()].slice(0, MAX_SAVED_BACKTESTS);
  try {
    window.localStorage.setItem(BACKTEST_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Sin almacenamiento disponible, el resultado sigue visible en pantalla.
  }
  return list;
}

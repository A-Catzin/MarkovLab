import type { DataFreshness, DataOrigin, ModuleCode, ModuleDeliveryState } from "./runtime";

/** Tipos de vista por módulo F1–F7 (todas las tasas y pesos expresados en fracciones 0..1). */

export type ReturnKind = "simple" | "log";
export type PeriodPreset = "3M" | "6M" | "1A" | "3A" | "custom";

export interface AssetAnalysisMetricRow {
  assetId: number;
  symbol: string;
  name: string;
  currency: string;
  observations: number;
  effectiveFrom: string;
  effectiveTo: string;
  simpleReturn: number | null;
  logReturn: number | null;
  cumulativeReturn: number | null;
  meanReturnDaily: number | null;
  volatilityDaily: number | null;
  volatilityAnnualized: number | null;
  maxDrawdown: number | null;
  peakDate: string | null;
  troughDate: string | null;
  note?: string;
}

export interface NormalizedAssetSeries {
  symbol: string;
  /** Puntos [fecha ISO, valor base 100] */
  points: [string, number][];
}

export interface AssetAnalysisData {
  catalog: { id: number; symbol: string; name: string; currency: string; availableObservations: number }[];
  selectedSymbols: string[];
  periodPreset: PeriodPreset;
  returnKind: ReturnKind;
  requestedFrom: string;
  requestedTo: string;
  effectiveFrom: string;
  effectiveTo: string;
  alignedObservations: number;
  annualizationFactor: number;
  metrics: AssetAnalysisMetricRow[];
  correlationSymbols: string[];
  /** Matriz simétrica N×N con diagonal = 1 y valores en [-1, 1], o null si no hay pares suficientes. */
  correlationMatrix: (number | null)[][];
  series: NormalizedAssetSeries[];
}

export interface MarketOriginPreviewRow {
  id: number;
  symbol: string;
  name: string;
  market: string;
  currency: string;
  latestPrice: number | null;
  latestDate: string | null;
  latestPriceSource?: "api" | "csv" | "manual" | null;
  latestPriceStatus?: "updated" | "cached" | "local_file" | "unavailable";
  priceSource: "api" | "csv" | null;
  dataFreshness: "fresh" | "cached" | "local" | null;
  updatedAt: string | null;
  changes: { daily: number | null; weekly: number | null; monthly: number | null };
}

export interface PortfolioVersionItem {
  id: string;
  versionNumber: number;
  name: string;
  createdAt: string;
  startDate: string;
  capital: number;
  currency: string;
  derivedFromId: string | null;
  derivedFromName: string | null;
  estimatedAnnualReturn: number | null;
  estimatedAnnualVolatility: number | null;
  isCurrent: boolean;
  positions: { assetId: number; symbol: string; name: string; weight: number }[];
}

export interface PortfolioEditData {
  portfolioId: string;
  portfolioName: string;
  capital: number;
  currency: string;
  startDate: string;
  catalog: { id: number; label: string; symbol: string; currency: string }[];
  positions: { assetId: number; symbol: string; percent: number }[];
  versions: PortfolioVersionItem[];
  pendingBackend: boolean;
}

export interface StressShockInput {
  presetId: string;
  label: string;
  description: string;
  /** Variación sobre rendimiento esperado anualizado (fracción, ej. -0.15 = -15 pp). */
  returnShift: number;
  /** Factor multiplicador de volatilidad (> 0, ej. 1.6 = +60 %). */
  volatilityMultiplier: number;
  /** Desplazamiento sobre correlaciones cruzadas (-1 a +1, acotado al dominio válido). */
  correlationShift: number;
}

export interface StressRunSummary {
  horizonDays: number;
  confidence: number;
  seed: number;
  simulations: number;
  expectedFinalValue: number;
  medianFinalValue: number;
  p5FinalValue: number;
  p95FinalValue: number;
  varFraction: number;
  varAmount: number;
  cvarFraction: number;
  cvarAmount: number;
}

export interface StressTestingData {
  portfolioId: string;
  portfolioName: string;
  capital: number;
  currency: string;
  horizonDays: number;
  confidence: number;
  seed: number;
  presets: StressShockInput[];
  activePresetId: string;
  baseline: StressRunSummary;
  stressedByPreset: Record<string, StressRunSummary>;
}

export type OptimizationObjective = "min_variance" | "max_sharpe";

export interface OptimizationWeightRow {
  assetId: number;
  symbol: string;
  name: string;
  market?: string;
  assetCurrency?: string;
  manualWeight: number;
  optimizedWeight: number;
  minWeight: number;
  maxWeight: number;
}

export interface OptimizationPortfolioStats {
  expectedAnnualReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number | null;
}

export interface OptimizationRunRecord {
  id: string;
  createdAt: string;
  portfolioId: string;
  portfolioVersion: number;
  portfolioName: string;
  capital: number;
  currency: string;
  startDate: string;
  objective: OptimizationObjective;
  objectiveValue: number;
  returnModel: string;
  periodsPerYear: number;
  riskFreeRate: number;
  lookbackYears: number;
  maxVolatilityCap: number | null;
  feasibleMinVolatility: number;
  window: { from: string; to: string };
  observations: number;
  weights: OptimizationWeightRow[];
  manualStats: OptimizationPortfolioStats;
  optimizedStats: OptimizationPortfolioStats;
  solver: string;
  solverWrapperVersion: string;
}

export interface OptimizationPortfolioOption {
  id: string;
  name: string;
  currency: string;
  positions: { assetId: number; symbol: string; name: string; manualWeight: number }[];
}

export interface OptimizationData {
  portfolioId?: string;
  portfolioName: string;
  currency?: string;
  availablePortfolios?: OptimizationPortfolioOption[];
  objective: OptimizationObjective;
  frequencyLabel: string;
  riskFreeRate: number;
  lookbackYears?: number;
  maxVolatilityCap: number | null;
  feasibleMinVolatility: number | null;
  weights: OptimizationWeightRow[];
  manualStats: OptimizationPortfolioStats | null;
  optimizedStats: OptimizationPortfolioStats | null;
  activeRun?: OptimizationRunRecord | null;
  history?: OptimizationRunRecord[];
}

export type PredictionMetricKind = "return" | "volatility";

export interface PredictionSeriesPoint {
  date: string;
  phase: "historical" | "forecast";
  dateEstimated?: boolean;
  historicalValue: number | null;
  forecastPoint: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  observedAfterValue: number | null;
}

export interface PredictionEvaluationSummary {
  observedPoints: number;
  mae: number;
  rmse: number;
  intervalCoverage: number;
}

export interface PredictionAssetOption {
  id: number;
  symbol: string;
  name: string;
  market?: string;
  lastDate?: string | null;
  priceRows?: number;
}

export interface PredictionData {
  assets: PredictionAssetOption[];
  selectedAssetId?: number | null;
  selectedSymbol: string;
  metric: PredictionMetricKind;
  horizonDays: 21 | 63 | 126;
  confidenceLabel: string;
  modelName: string;
  modelParameters: string;
  trainingWindow: { from: string; to: string; observations: number };
  calculatedAt: string;
  asOf?: string | null;
  activePredictionId?: string | null;
  point?: number | null;
  lowerBound?: number | null;
  upperBound?: number | null;
  predictionLoadError?: string | null;
  hasPostObservations: boolean;
  evaluation: PredictionEvaluationSummary | null;
  limitations: string[];
  series: PredictionSeriesPoint[];
}

export type BacktestStrategyId = "manual" | "min_variance" | "max_sharpe";

export type BacktestRebalanceFrequency = "none" | "monthly" | "quarterly" | "semiannual";

export interface BacktestCurvePoint {
  date: string;
  phase: "config" | "evaluation";
  strategyIndex: number;
  benchmarkIndex: number | null;
}

export interface BacktestMetricsBlock {
  cumulativeReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  maxDrawdown: number;
  sharpeRatio: number | null;
}

export interface BacktestWeightRow {
  assetId: number;
  symbol: string;
  market: string;
  manualWeight: number;
  targetWeight: number;
}

export interface BacktestRunRecord {
  id: string;
  portfolioId?: string;
  portfolioVersion?: number;
  portfolioName?: string;
  currency?: string;
  model?: string;
  strategy?: BacktestStrategyId;
  strategyName: string;
  rebalance?: BacktestRebalanceFrequency;
  rebalanceLabel: string;
  benchmarkAssetId?: number | null;
  benchmarkSymbol: string | null;
  benchmarkCurrency?: string | null;
  configFrom: string;
  configTo: string;
  evalFrom: string;
  evalTo: string;
  configurationWindow?: { from: string; to: string; observations: number };
  evaluationWindow?: { from: string; to: string; observations: number };
  transactionCostBps: number;
  riskFreeRate?: number;
  weights?: BacktestWeightRow[];
  strategyMetrics: BacktestMetricsBlock;
  benchmarkMetrics: BacktestMetricsBlock | null;
  executedAt: string;
  curve: BacktestCurvePoint[];
}

export interface BacktestingData {
  portfolioId?: string;
  portfolioName?: string;
  portfolioCurrency?: string;
  availablePortfolios?: { id: string; name: string; currency: string }[];
  strategies: { id: string; name: string; description: string }[];
  benchmarks: { id?: number | null; symbol: string; label: string }[];
  runs: BacktestRunRecord[];
  activeRunId: string | null;
}

export interface DashboardModuleSummary {
  code: ModuleCode;
  name: string;
  srsRefs: string;
  href: string;
  deliveryState: ModuleDeliveryState;
  backendStatusLabel: string;
  description: string;
  available: boolean;
}

export interface DashboardRecentAnalysis {
  id: string;
  moduleName: string;
  title: string;
  periodLabel: string;
  origin: DataOrigin;
  freshness: DataFreshness;
  calculatedAt: string;
  headlineMetricLabel: string;
  headlineMetricValue: string;
  href: string;
}

export interface DashboardOverviewData {
  userName: string | null;
  portfolioCount: number;
  watchlistCount: number;
  latestOriginSummary: string;
  modules: DashboardModuleSummary[];
  recentAnalyses: DashboardRecentAnalysis[];
}

export interface ReportAnalysisItem {
  id: string;
  moduleCode: ModuleCode;
  title: string;
  subject: string;
  periodFrom: string;
  periodTo: string;
  calculatedAt: string;
  origin: DataOrigin;
  freshness: DataFreshness;
  frequency: string;
  currency: string;
  primaryMetricLabel: string;
  primaryMetricValue: string;
  secondaryMetricLabel: string;
  secondaryMetricValue: string;
}

export interface MetricFormulaDoc {
  id: string;
  name: string;
  unit: string;
  formula: string;
  interpretation: string;
  assumptions: string;
}

export interface ReportsData {
  reports: ReportAnalysisItem[];
  formulas: MetricFormulaDoc[];
  exportCapabilities: {
    csvAvailable: boolean;
    reasonWhenUnavailable: string;
    expectedColumns: string[];
  };
}

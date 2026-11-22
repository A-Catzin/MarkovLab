import { SAMPLE_ASSETS, SAMPLE_CORRELATION } from "./landing-data";
import { TRADING_DAYS, portfolioMoments, type SampleAsset } from "./simulation";

/**
 * Modelo provisional de carteras para el navegador. El SRS asigna la persistencia
 * al backend Julia; mientras esa API no exista, las carteras se guardan en
 * `localStorage` con la misma forma que tendrá la base de datos.
 */

export const CURRENCIES = ["MXN", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const MAX_CAPITAL = 1_000_000_000;
export const WEIGHT_TOLERANCE = 0.01;

export interface PortfolioAsset {
  ticker: string;
  /** Peso en porcentaje: 0 a 100. */
  weight: number;
}

export interface PortfolioVersionSnapshot {
  version: number;
  createdAt: string;
  note?: string;
  capital: number;
  currency: Currency;
  assets: PortfolioAsset[];
  metrics?: PortfolioMetrics | null;
}

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  capital: number;
  currency: Currency;
  /** Fecha ISO (YYYY-MM-DD) de creación. */
  createdAt: string;
  updatedAt: string;
  /** 1 para la original; sube al guardar una versión nueva. */
  version: number;
  assets: PortfolioAsset[];
  /** Historial de versiones guardadas (RF-32) */
  versions?: PortfolioVersionSnapshot[];
}

export interface PortfolioMetrics {
  annualReturn: number;
  annualVolatility: number;
  sharpeRatio: number;
  diversificationBenefit: number;
}

export const PORTFOLIO_STORAGE_KEY = "markovlab.portfolios.v1";

/** Carteras de ejemplo para que el módulo tenga contenido en la primera visita. */
export const DEMO_PORTFOLIOS: Portfolio[] = [
  {
    id: "demo-base",
    name: "Cartera base MarkovLab",
    description: "Cartera balanceada de referencia entre tecnología, banca y energía para calibrar el modelo Monte Carlo.",
    capital: 10_000,
    currency: "MXN",
    createdAt: "2026-11-03",
    updatedAt: "2026-11-03",
    version: 1,
    assets: [
      { ticker: "AAPL", weight: 32 },
      { ticker: "MSFT", weight: 28 },
      { ticker: "JPM", weight: 22 },
      { ticker: "XOM", weight: 18 },
    ],
    versions: [
      {
        version: 1,
        createdAt: "2026-11-03",
        note: "Versión inicial de referencia",
        capital: 10_000,
        currency: "MXN",
        assets: [
          { ticker: "AAPL", weight: 32 },
          { ticker: "MSFT", weight: 28 },
          { ticker: "JPM", weight: 22 },
          { ticker: "XOM", weight: 18 },
        ],
      },
    ],
  },
  {
    id: "demo-tecnologia",
    name: "Tecnología y energía",
    description: "Mayor ponderación en líderes tecnológicos estadounidenses combinados con energía para cobertura.",
    capital: 25_000,
    currency: "MXN",
    createdAt: "2026-11-10",
    updatedAt: "2026-11-10",
    version: 1,
    assets: [
      { ticker: "AAPL", weight: 45 },
      { ticker: "MSFT", weight: 35 },
      { ticker: "JPM", weight: 0 },
      { ticker: "XOM", weight: 20 },
    ],
    versions: [
      {
        version: 1,
        createdAt: "2026-11-10",
        note: "Configuración enfocada en crecimiento",
        capital: 25_000,
        currency: "MXN",
        assets: [
          { ticker: "AAPL", weight: 45 },
          { ticker: "MSFT", weight: 35 },
          { ticker: "JPM", weight: 0 },
          { ticker: "XOM", weight: 20 },
        ],
      },
    ],
  },
  {
    id: "demo-conservadora",
    name: "Conservadora dividendos",
    description: "Perfil defensivo con fuerte peso en el sector financiero y energético para menor volatilidad.",
    capital: 50_000,
    currency: "MXN",
    createdAt: "2026-11-16",
    updatedAt: "2026-11-16",
    version: 2,
    assets: [
      { ticker: "AAPL", weight: 20 },
      { ticker: "MSFT", weight: 20 },
      { ticker: "JPM", weight: 40 },
      { ticker: "XOM", weight: 20 },
    ],
    versions: [
      {
        version: 1,
        createdAt: "2026-11-12",
        note: "Versión preliminar 50/50 entre JPM y XOM",
        capital: 45_000,
        currency: "MXN",
        assets: [
          { ticker: "AAPL", weight: 0 },
          { ticker: "MSFT", weight: 0 },
          { ticker: "JPM", weight: 50 },
          { ticker: "XOM", weight: 50 },
        ],
      },
      {
        version: 2,
        createdAt: "2026-11-16",
        note: "Inclusión de tecnología para diversificar retorno",
        capital: 50_000,
        currency: "MXN",
        assets: [
          { ticker: "AAPL", weight: 20 },
          { ticker: "MSFT", weight: 20 },
          { ticker: "JPM", weight: 40 },
          { ticker: "XOM", weight: 20 },
        ],
      },
    ],
  },
];

export function totalWeight(assets: PortfolioAsset[]): number {
  return assets.reduce((sum, asset) => sum + asset.weight, 0);
}

/** Rendimiento, volatilidad, ratio de Sharpe y diversificación anuales estimados (RF-30). */
export function portfolioMetrics(assets: PortfolioAsset[], riskFreeRate = 0.045): PortfolioMetrics | null {
  const held = assets.filter((asset) => asset.weight > 0);
  if (held.length === 0) return null;

  const subset: SampleAsset[] = [];
  const indices: number[] = [];
  const weights: number[] = [];
  let total = 0;

  for (const asset of held) {
    const index = SAMPLE_ASSETS.findIndex((sample) => sample.ticker === asset.ticker);
    if (index === -1) continue;
    indices.push(index);
    subset.push(SAMPLE_ASSETS[index]);
    weights.push(asset.weight);
    total += asset.weight;
  }

  if (subset.length === 0 || total <= 0) return null;

  const correlation = indices.map((row) => indices.map((column) => SAMPLE_CORRELATION[row][column]));
  const normalized = weights.map((weight) => weight / total);
  const { mu, sigma } = portfolioMoments(subset, correlation, normalized);

  const annualReturn = mu * TRADING_DAYS;
  const annualVolatility = sigma * Math.sqrt(TRADING_DAYS);

  let undiversified = 0;
  for (let i = 0; i < subset.length; i++) {
    undiversified += normalized[i] * subset[i].annualVolatility;
  }

  const diversificationBenefit =
    undiversified > 0 ? Math.max(0, (undiversified - annualVolatility) / undiversified) : 0;
  const sharpeRatio =
    annualVolatility > 0 ? (annualReturn - riskFreeRate) / annualVolatility : 0;

  return {
    annualReturn,
    annualVolatility,
    sharpeRatio,
    diversificationBenefit,
  };
}

/** Duplica una cartera para modificarla sin alterar la original (RF-33). */
export function duplicatePortfolio(original: Portfolio): Portfolio {
  const now = todayISO();
  return {
    ...original,
    id: createId(),
    name: `${original.name} (copia)`,
    version: 1,
    createdAt: now,
    updatedAt: now,
    assets: original.assets.map((a) => ({ ...a })),
    versions: [
      {
        version: 1,
        createdAt: now,
        note: `Copia creada a partir de ${original.name} (v${original.version})`,
        capital: original.capital,
        currency: original.currency,
        assets: original.assets.map((a) => ({ ...a })),
        metrics: portfolioMetrics(original.assets),
      },
    ],
  };
}

/** Guarda una nueva versión de una cartera preservando el historial anterior (RF-32). */
export function createNewVersion(
  original: Portfolio,
  updates: {
    name?: string;
    capital?: number;
    currency?: Currency;
    assets: PortfolioAsset[];
    note?: string;
  },
): Portfolio {
  const nextVersionNumber = original.version + 1;
  const now = todayISO();
  const currentSnapshot: PortfolioVersionSnapshot = {
    version: original.version,
    createdAt: original.updatedAt || original.createdAt,
    note: `Versión ${original.version}`,
    capital: original.capital,
    currency: original.currency,
    assets: original.assets.map((a) => ({ ...a })),
    metrics: portfolioMetrics(original.assets),
  };

  const existingHistory = original.versions && original.versions.length > 0
    ? original.versions
    : [currentSnapshot];

  const newSnapshot: PortfolioVersionSnapshot = {
    version: nextVersionNumber,
    createdAt: now,
    note: updates.note || `Versión ${nextVersionNumber}`,
    capital: updates.capital ?? original.capital,
    currency: updates.currency ?? original.currency,
    assets: updates.assets.map((a) => ({ ...a })),
    metrics: portfolioMetrics(updates.assets),
  };

  return {
    ...original,
    name: updates.name ?? original.name,
    capital: updates.capital ?? original.capital,
    currency: updates.currency ?? original.currency,
    version: nextVersionNumber,
    updatedAt: now,
    assets: updates.assets.map((a) => ({ ...a })),
    versions: [...existingHistory, newSnapshot],
  };
}

export const formatPercent = (value: number, digits = 1) =>
  `${(value * 100).toLocaleString("es-MX", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

export const formatSignedPercent = (value: number, digits = 1) =>
  `${value >= 0 ? "+" : "−"}${formatPercent(Math.abs(value), digits)}`;

export const formatMoney = (value: number, currency: Currency = "MXN") =>
  value.toLocaleString("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

export function validatePortfolio(input: {
  name: string;
  capital: number;
  assets: PortfolioAsset[];
}): string[] {
  const errors: string[] = [];

  if (input.name.trim().length === 0) errors.push("Escribe un nombre para la cartera.");

  if (!Number.isFinite(input.capital) || input.capital <= 0) {
    errors.push("El capital inicial debe ser mayor que cero.");
  } else if (input.capital > MAX_CAPITAL) {
    errors.push("El capital inicial supera el máximo permitido.");
  }

  if (input.assets.length === 0) errors.push("Agrega al menos un activo.");

  if (input.assets.some((asset) => !Number.isFinite(asset.weight) || asset.weight < 0 || asset.weight > 100)) {
    errors.push("Cada peso debe estar entre 0 % y 100 %.");
  }

  const total = totalWeight(input.assets);
  if (Math.abs(total - 100) > WEIGHT_TOLERANCE) {
    errors.push(`Los pesos suman ${total.toLocaleString("es-MX", { maximumFractionDigits: 2 })} %; deben sumar 100 %.`);
  }

  return errors;
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isCurrency(value: unknown): value is Currency {
  return value === "MXN" || value === "USD";
}

function isPortfolio(value: unknown): value is Portfolio {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.capital === "number" &&
    isCurrency(item.currency) &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string" &&
    typeof item.version === "number" &&
    Array.isArray(item.assets) &&
    item.assets.every(
      (asset) =>
        typeof asset === "object" &&
        asset !== null &&
        typeof (asset as Record<string, unknown>).ticker === "string" &&
        typeof (asset as Record<string, unknown>).weight === "number",
    )
  );
}

export function getSampleAsset(ticker: string): SampleAsset | undefined {
  return SAMPLE_ASSETS.find((a) => a.ticker === ticker);
}

/** Devuelve `null` si nunca se guardó nada; un arreglo vacío si se borraron todas. */
export function readPortfolios(): Portfolio[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isPortfolio);
  } catch {
    return null;
  }
}

export function writePortfolios(portfolios: Portfolio[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolios));
  } catch {
    // Si el navegador bloquea el almacenamiento, la sesión sigue funcionando en memoria.
  }
}

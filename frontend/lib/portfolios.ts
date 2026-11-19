import "server-only";
import { backendFetch } from "./backend";

/**
 * Datos de "Mis carteras", leídos del backend con el id del usuario que navega
 * (`X-Actor-Id`). El backend solo devuelve las carteras de ese usuario.
 */

export interface CatalogAsset {
  id: number;
  symbol: string;
  name: string;
  market: string;
  category: string;
  currency: string;
  price_rows: number;
  first_date: string | null;
  last_date: string | null;
}

export interface PortfolioPosition {
  asset_id: number;
  symbol: string;
  market: string;
  name: string;
  /** Fracción entre 0 y 1 (0.4 = 40 %). */
  weight: number;
  /** Moneda en que cotiza el activo; la historia y la simulación la convierten a la de la cartera. */
  currency: string;
}

/**
 * Aclaración sobre la moneda de una cartera: si algún activo cotiza en otra, sus precios se
 * convierten con el tipo de cambio diario.
 */
export function currencyNote(portfolio: Portfolio) {
  const others = [...new Set(portfolio.positions.map((p) => p.currency).filter((c) => c !== portfolio.currency))];
  if (others.length === 0) return `Todos los activos cotizan en ${portfolio.currency}.`;
  return `Precios en ${others.join(" y ")} convertidos a ${portfolio.currency} con el tipo de cambio de cada día.`;
}

export interface Portfolio {
  id: string;
  name: string;
  capital: number;
  currency: string;
  start_date: string;
  status: "draft" | "active" | "archived";
  created_at: string | null;
  positions: PortfolioPosition[];
}

export const getCatalogAssets = async (actorId: string) =>
  (await backendFetch<{ assets: CatalogAsset[] }>("/api/internal/assets", { actorId })).assets;

export const getPortfolios = async (actorId: string) =>
  (await backendFetch<{ portfolios: Portfolio[] }>("/api/internal/portfolios", { actorId })).portfolios;

export const getPortfolio = (actorId: string, id: string) =>
  backendFetch<Portfolio>(`/api/internal/portfolios/${encodeURIComponent(id)}`, { actorId });

/** Valor diario de la cartera (comprar y mantener), anclado en el día en que se creó. */
export interface PortfolioHistory {
  currency: string;
  capital: number;
  anchor_date: string;
  /** `[fecha ISO, valor]`, del día más viejo al más nuevo. */
  points: [string, number][];
}

export const getPortfolioHistory = (actorId: string, id: string) =>
  backendFetch<PortfolioHistory>(`/api/internal/portfolios/${encodeURIComponent(id)}/history`, { actorId });

/**
 * Una simulación Monte Carlo guardada de la cartera. Los rendimientos, el VaR y el CVaR son
 * fracciones del capital en el horizonte (0.05 = 5 %); el VaR y el CVaR, pérdidas positivas.
 */
export interface Simulation {
  id: string;
  portfolio_id: string | null;
  model: string;
  simulations: number;
  /** Días hábiles (21 ≈ un mes). */
  horizon: number;
  confidence: number;
  seed: number;
  observations: number;
  symbols: string[];
  weights: number[];
  /** Días de precios con que se estimó. */
  window: { from: string; to: string };
  /** Rendimiento y volatilidad esperados por día. */
  expected_return: number;
  expected_volatility: number;
  value_at_risk: number;
  conditional_value_at_risk: number;
  summary: {
    scenarios: number;
    mean: number;
    worst: number;
    best: number;
    confidence: number;
    percentiles: Record<string, number>;
  };
  created_at: string | null;
}

export const getSimulations = async (actorId: string, id: string) =>
  (
    await backendFetch<{ simulations: Simulation[] }>(
      `/api/internal/portfolios/${encodeURIComponent(id)}/simulations`,
      { actorId },
    )
  ).simulations;

export const STATUS_LABELS: Record<Portfolio["status"], string> = {
  draft: "Borrador",
  active: "Activa",
  archived: "Archivada",
};

/** Monto con su moneda en formato de México (por ejemplo "$10,000.00 USD"). */
export function formatMoney(value: number, currency: string) {
  return `${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/** Peso como porcentaje con hasta dos decimales ("33.33 %"). */
export const formatWeight = (weight: number) =>
  `${(weight * 100).toLocaleString("es-MX", { maximumFractionDigits: 2 })} %`;

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

/**
 * Metadatos visuales por activo: color de las barras de composición y leyendas.
 * Centralizado aquí para que carteras y optimización no dupliquen la paleta.
 */

export const ASSET_COLORS: Record<string, string> = {
  AAPL: "#5a9bfc", // aciano / accent
  MSFT: "#38bdf8", // azul cielo
  JPM: "#818cf8", // índigo
  XOM: "#fbbf24", // ámbar
  NVDA: "#34d399", // esmeralda
  GOOGL: "#f472b6", // rosa
  AMZN: "#fb923c", // naranja
  TSLA: "#f87171", // rojo
  SPY: "#22d3ee", // cian
  BND: "#a78bfa", // violeta
};

const FALLBACK_COLORS = ["#5a9bfc", "#38bdf8", "#818cf8", "#fbbf24", "#34d399", "#f472b6"];

export function getAssetColor(ticker: string, index: number): string {
  if (ticker in ASSET_COLORS) return ASSET_COLORS[ticker];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

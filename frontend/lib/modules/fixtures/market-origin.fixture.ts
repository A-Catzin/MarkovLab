import type { AdapterResult, ViewScenario } from "../runtime";
import type { MarketOriginPreviewRow } from "../types";

const SAMPLE_WATCHLIST: readonly MarketOriginPreviewRow[] = [
  {
    id: 1,
    symbol: "AAPL",
    name: "Apple Inc.",
    market: "NASDAQ",
    currency: "USD",
    latestPrice: 229.45,
    latestDate: "2026-10-30",
    latestPriceSource: "api",
    latestPriceStatus: "updated",
    priceSource: "api",
    dataFreshness: "fresh",
    updatedAt: "2026-10-30T21:15:00Z",
    changes: { daily: 0.0114, weekly: 0.0268, monthly: 0.0492 },
  },
  {
    id: 2,
    symbol: "MSFT",
    name: "Microsoft Corp.",
    market: "NASDAQ",
    currency: "USD",
    latestPrice: 438.2,
    latestDate: "2026-10-29",
    latestPriceSource: "api",
    latestPriceStatus: "cached",
    priceSource: "api",
    dataFreshness: "cached",
    updatedAt: "2026-10-29T21:10:00Z",
    changes: { daily: -0.0042, weekly: 0.0135, monthly: 0.031 },
  },
  {
    id: 4,
    symbol: "WALMEX.MX",
    name: "Wal-Mart de México",
    market: "BMV",
    currency: "MXN",
    latestPrice: 64.8,
    latestDate: "2026-10-28",
    latestPriceSource: "csv",
    latestPriceStatus: "local_file",
    priceSource: "csv",
    dataFreshness: "local",
    updatedAt: "2026-10-28T18:40:00Z",
    changes: { daily: 0.0, weekly: -0.011, monthly: 0.0215 },
  },
  {
    id: 6,
    symbol: "NU",
    name: "Nu Holdings",
    market: "NYSE",
    currency: "USD",
    latestPrice: null,
    latestDate: null,
    latestPriceSource: null,
    latestPriceStatus: "unavailable",
    priceSource: null,
    dataFreshness: null,
    updatedAt: null,
    changes: { daily: null, weekly: null, monthly: null },
  },
];

export function buildMarketOriginFixture(scenario: ViewScenario = "normal"): AdapterResult<MarketOriginPreviewRow[]> {
  if (scenario === "vacio") {
    return {
      status: "empty",
      title: "Lista de seguimiento vacía",
      message: "Todavía no sigues ningún activo. Agrega activos del catálogo para monitorear su último cierre y su origen de carga.",
      actionLabel: "Ir al análisis de activos",
      actionHref: "/dev/vistas/analisis",
    };
  }
  if (scenario === "no-disponible") {
    return {
      status: "unavailable",
      title: "Servicio de mercado no disponible",
      message: "No fue posible consultar los últimos cierres registrados. Inténtalo de nuevo en unos minutos.",
      lastUpdated: "2026-10-30 16:15",
    };
  }
  if (scenario === "denegado") {
    return {
      status: "forbidden",
      title: "Sesión requerida para consultar el mercado",
      message: "Inicia sesión para consultar tu lista de seguimiento personal.",
    };
  }
  if (scenario === "pocos-datos") {
    return {
      status: "ok",
      data: [SAMPLE_WATCHLIST[3]],
      provenance: {
        origin: "fixtures",
        freshness: "example",
        isExample: true,
        calculatedAt: "2026-10-30 16:15",
        assumptions: "Vista previa del caso sin precios cargados",
      },
    };
  }

  return {
    status: "ok",
    data: [...SAMPLE_WATCHLIST],
    provenance: {
      origin: "mixed",
      freshness: "example",
      isExample: true,
      calculatedAt: "2026-10-30 16:15",
      assumptions: "Muestra de origen y frescura: distingue API actualizado, caché y carga manual CSV",
    },
  };
}

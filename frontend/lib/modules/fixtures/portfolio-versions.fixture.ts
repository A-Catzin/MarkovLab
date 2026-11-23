import type { AdapterResult, ViewScenario } from "../runtime";
import type { PortfolioEditData, PortfolioVersionItem } from "../types";

const CATALOG = [
  { id: 1, label: "AAPL · NASDAQ · Apple Inc. (USD)", symbol: "AAPL", currency: "USD" },
  { id: 2, label: "MSFT · NASDAQ · Microsoft Corp. (USD)", symbol: "MSFT", currency: "USD" },
  { id: 3, label: "JPM · NYSE · JPMorgan Chase & Co. (USD)", symbol: "JPM", currency: "USD" },
  { id: 4, label: "WALMEX.MX · BMV · Wal-Mart de México (MXN)", symbol: "WALMEX.MX", currency: "MXN" },
  { id: 5, label: "XOM · NYSE · Exxon Mobil Corp. (USD)", symbol: "XOM", currency: "USD" },
];

const VERSIONS: PortfolioVersionItem[] = [
  {
    id: "pf-v3",
    versionNumber: 3,
    name: "Núcleo Académico · v3 (actual)",
    createdAt: "2026-10-28 14:20",
    startDate: "2025-11-03",
    capital: 250000,
    currency: "MXN",
    derivedFromId: "pf-v2",
    derivedFromName: "Núcleo Académico · v2",
    estimatedAnnualReturn: 0.146,
    estimatedAnnualVolatility: 0.168,
    isCurrent: true,
    positions: [
      { assetId: 1, symbol: "AAPL", name: "Apple Inc.", weight: 0.3 },
      { assetId: 2, symbol: "MSFT", name: "Microsoft Corp.", weight: 0.3 },
      { assetId: 3, symbol: "JPM", name: "JPMorgan Chase & Co.", weight: 0.2 },
      { assetId: 4, symbol: "WALMEX.MX", name: "Wal-Mart de México", weight: 0.2 },
    ],
  },
  {
    id: "pf-v2",
    versionNumber: 2,
    name: "Núcleo Académico · v2",
    createdAt: "2026-08-12 10:05",
    startDate: "2025-11-03",
    capital: 250000,
    currency: "MXN",
    derivedFromId: "pf-v1",
    derivedFromName: "Núcleo Académico · v1",
    estimatedAnnualReturn: 0.132,
    estimatedAnnualVolatility: 0.159,
    isCurrent: false,
    positions: [
      { assetId: 1, symbol: "AAPL", name: "Apple Inc.", weight: 0.25 },
      { assetId: 2, symbol: "MSFT", name: "Microsoft Corp.", weight: 0.25 },
      { assetId: 3, symbol: "JPM", name: "JPMorgan Chase & Co.", weight: 0.25 },
      { assetId: 4, symbol: "WALMEX.MX", name: "Wal-Mart de México", weight: 0.25 },
    ],
  },
  {
    id: "pf-v1",
    versionNumber: 1,
    name: "Núcleo Académico · v1",
    createdAt: "2026-05-04 09:30",
    startDate: "2025-11-03",
    capital: 200000,
    currency: "MXN",
    derivedFromId: null,
    derivedFromName: null,
    estimatedAnnualReturn: 0.118,
    estimatedAnnualVolatility: 0.174,
    isCurrent: false,
    positions: [
      { assetId: 1, symbol: "AAPL", name: "Apple Inc.", weight: 0.4 },
      { assetId: 4, symbol: "WALMEX.MX", name: "Wal-Mart de México", weight: 0.4 },
      { assetId: 5, symbol: "XOM", name: "Exxon Mobil Corp.", weight: 0.2 },
    ],
  },
];

export function buildPortfolioVersionsFixture(params: {
  portfolioId: string;
  scenario?: ViewScenario;
}): AdapterResult<PortfolioEditData> {
  const scenario = params.scenario ?? "normal";

  if (scenario === "vacio") {
    return {
      status: "empty",
      title: "Esta cartera no tiene versiones guardadas",
      message: "Guarda una versión inicial o crea una cartera nueva para habilitar el historial de cambios.",
      actionLabel: "Ir a Mis carteras",
      actionHref: "/app/carteras",
    };
  }
  if (scenario === "no-disponible") {
    return {
      status: "unavailable",
      title: "No fue posible cargar la cartera ni sus versiones",
      message: "El servicio de carteras no respondió dentro del tiempo esperado.",
      lastUpdated: "2026-10-28 14:20",
    };
  }
  if (scenario === "denegado") {
    return {
      status: "forbidden",
      title: "Sin permiso para editar esta cartera",
      message: "Solo el propietario registrado puede editar, versionar o duplicar esta cartera.",
    };
  }
  if (scenario === "pocos-datos") {
    return {
      status: "insufficient_data",
      title: "Sin precios suficientes para recalcular riesgo estimado",
      message: "La cartera puede ajustarse en composición, pero uno de sus activos no tiene histórico completo para estimar rendimiento y volatilidad.",
      details: ["Faltan cierres diarios comunes para el período seleccionado."],
    };
  }

  return {
    status: "ok",
    data: {
      portfolioId: params.portfolioId,
      portfolioName: VERSIONS[0].name,
      capital: VERSIONS[0].capital,
      currency: VERSIONS[0].currency,
      startDate: VERSIONS[0].startDate,
      catalog: CATALOG,
      positions: VERSIONS[0].positions.map((pos) => ({
        assetId: pos.assetId,
        symbol: pos.symbol,
        percent: Number((pos.weight * 100).toFixed(2)),
      })),
      versions: VERSIONS,
      pendingBackend: true,
    },
    provenance: {
      origin: "fixtures",
      freshness: "example",
      isExample: true,
      calculatedAt: "2026-10-30 16:15",
      assumptions: "Guardado y duplicación pendientes del backend B3 (validación activa en pantalla)",
    },
  };
}

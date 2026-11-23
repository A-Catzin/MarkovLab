import type { Metadata } from "next";
import Link from "next/link";
import { AssetAnalysisView } from "@/components/app/AssetAnalysisView";
import { ExampleDataBanner } from "@/components/app/ModuleStateViews";
import { requireUser } from "@/lib/guards";
import { loadAssetAnalysisView } from "@/lib/modules/adapters/asset-analysis.server";
import { parseScenario } from "@/lib/modules/runtime";
import type { PeriodPreset, ReturnKind } from "@/lib/modules/types";

export const metadata: Metadata = {
  title: "Análisis de activos · MarkovLab",
  description: "Rendimientos, volatilidad, drawdown y matriz de correlación histórica entre activos.",
};

const VALID_PERIODS = new Set<PeriodPreset>(["3M", "6M", "1A", "3A", "custom"]);

export default async function MarketAssetAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{
    activos?: string;
    periodo?: string;
    retorno?: string;
    desde?: string;
    hasta?: string;
    escenario?: string;
  }>;
}) {
  const user = await requireUser();
  const q = await searchParams;
  const parsedSymbols = q.activos
    ? q.activos
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  const period: PeriodPreset = VALID_PERIODS.has(q.periodo as PeriodPreset) ? (q.periodo as PeriodPreset) : "1A";
  const returnKind: ReturnKind = q.retorno === "log" ? "log" : "simple";
  const from = q.desde ?? "2026-01-05";
  const to = q.hasta ?? "2026-10-30";
  const scenario = parseScenario(q.escenario);

  const result = await loadAssetAnalysisView({
    actorId: user.id,
    symbols: parsedSymbols,
    period,
    from,
    to,
    returnKind,
    scenario,
  });

  return (
    <>
      <p className="crumbs">
        <Link href="/app/mercado">Mercado</Link> / Análisis de activos
      </p>
      {result.status === "ok" && result.provenance.isExample && (
        <ExampleDataBanner moduleName="Análisis de activos (F1)" />
      )}
      <AssetAnalysisView
        result={result}
        basePath="/app/mercado/analisis"
        currentScenario={scenario}
        initialSymbols={result.status === "ok" ? result.data.selectedSymbols : (parsedSymbols ?? ["AAPL", "MSFT"])}
        initialPeriod={period}
        initialReturnKind={returnKind}
        initialFrom={from}
        initialTo={to}
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { BacktestingView } from "@/components/app/BacktestingView";
import { ExampleDataBanner } from "@/components/app/ModuleStateViews";
import { requireUser } from "@/lib/guards";
import { loadBacktestingView } from "@/lib/modules/adapters/backtesting.server";
import { parseScenario } from "@/lib/modules/runtime";

export const metadata: Metadata = {
  title: "Backtesting de estrategias · MarkovLab",
  description: "Evaluación histórica fuera de muestra separada de la configuración.",
};

export default async function BacktestingPage({
  searchParams,
}: {
  searchParams: Promise<{ cartera?: string; corrida?: string; escenario?: string }>;
}) {
  const user = await requireUser();
  const q = await searchParams;
  const scenario = parseScenario(q.escenario);

  const result = await loadBacktestingView({
    actorId: user.id,
    portfolioId: q.cartera,
    runId: q.corrida,
    scenario,
  });

  const resolvedPortfolioId = result.status === "ok" ? result.data.portfolioId ?? "" : q.cartera ?? "";
  const resolvedRunId = result.status === "ok" ? result.data.activeRunId ?? "" : q.corrida ?? "";
  const viewKey = `${resolvedPortfolioId}:${resolvedRunId}:${scenario}`;

  return (
    <>
      <p className="crumbs">
        <Link href="/app">Laboratorio</Link> / Backtesting
      </p>
      {result.status === "ok" && result.provenance.isExample && (
        <ExampleDataBanner moduleName="Backtesting de estrategias (F6)" />
      )}
      <BacktestingView
        key={viewKey}
        result={result}
        basePath="/app/backtesting"
        currentScenario={scenario}
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ExampleDataBanner } from "@/components/app/ModuleStateViews";
import { OptimizationView } from "@/components/app/OptimizationView";
import { requireUser } from "@/lib/guards";
import { loadOptimizationView } from "@/lib/modules/adapters/optimization.server";
import { parseScenario } from "@/lib/modules/runtime";
import type { OptimizationObjective } from "@/lib/modules/types";

export const metadata: Metadata = {
  title: "Optimización de carteras · MarkovLab",
  description: "Mínima varianza, máximo Sharpe, cotas por activo, tope de volatilidad e historial auditable.",
};

export default async function OptimizationPage({
  searchParams,
}: {
  searchParams: Promise<{ cartera?: string; objetivo?: string; ejecucion?: string; escenario?: string }>;
}) {
  const user = await requireUser();
  const q = await searchParams;
  const objective: OptimizationObjective | undefined =
    q.objetivo === "min_variance" || q.objetivo === "max_sharpe" ? q.objetivo : undefined;
  const scenario = parseScenario(q.escenario);

  const result = await loadOptimizationView({
    actorId: user.id,
    portfolioId: q.cartera,
    runId: q.ejecucion,
    objective,
    scenario,
  });

  const resolvedObjective: OptimizationObjective =
    objective ?? (result.status === "ok" ? result.data.objective : "min_variance");
  const viewKey = `${q.cartera ?? "default"}-${q.ejecucion ?? "latest"}-${scenario}-${resolvedObjective}`;

  return (
    <>
      <p className="crumbs">
        <Link href="/app">Laboratorio</Link> / Optimización
      </p>
      {result.status === "ok" && result.provenance.isExample && (
        <ExampleDataBanner moduleName="Optimización de carteras (F4)" />
      )}
      <OptimizationView
        key={viewKey}
        result={result}
        basePath="/app/optimizacion"
        currentScenario={scenario}
        initialObjective={resolvedObjective}
      />
    </>
  );
}
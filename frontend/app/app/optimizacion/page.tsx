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
  description: "Mínima varianza, máximo Sharpe y comparación de pesos bajo restricciones.",
};

export default async function OptimizationPage({
  searchParams,
}: {
  searchParams: Promise<{ objetivo?: string; escenario?: string }>;
}) {
  const user = await requireUser();
  const q = await searchParams;
  const objective: OptimizationObjective = q.objetivo === "min_variance" ? "min_variance" : "max_sharpe";
  const scenario = parseScenario(q.escenario);

  const result = await loadOptimizationView({
    actorId: user.id,
    objective,
    scenario,
  });

  return (
    <>
      <p className="crumbs">
        <Link href="/app">Laboratorio</Link> / Optimización
      </p>
      {result.status === "ok" && result.provenance.isExample && (
        <ExampleDataBanner moduleName="Optimización de carteras (F4)" />
      )}
      <OptimizationView
        result={result}
        basePath="/app/optimizacion"
        currentScenario={scenario}
        initialObjective={objective}
      />
    </>
  );
}

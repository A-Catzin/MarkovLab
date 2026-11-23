import type { Metadata } from "next";
import Link from "next/link";
import { ExampleDataBanner } from "@/components/app/ModuleStateViews";
import { ReportsView } from "@/components/app/ReportsView";
import { requireUser } from "@/lib/guards";
import { loadReportsView } from "@/lib/modules/adapters/reports.server";
import { parseScenario } from "@/lib/modules/runtime";

export const metadata: Metadata = {
  title: "Reportes y detalle matemático · MarkovLab",
  description: "Resumen consolidado de análisis, fórmulas matemáticas y exportación CSV.",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ escenario?: string }>;
}) {
  const user = await requireUser();
  const { escenario } = await searchParams;
  const scenario = parseScenario(escenario);

  const result = await loadReportsView({
    actorId: user.id,
    scenario,
  });

  return (
    <>
      <p className="crumbs">
        <Link href="/app">Laboratorio</Link> / Reportes
      </p>
      {result.status === "ok" && result.provenance.isExample && (
        <ExampleDataBanner moduleName="Reportes y detalle matemático (F7)" />
      )}
      <ReportsView result={result} currentScenario={scenario} />
    </>
  );
}

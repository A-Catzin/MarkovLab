import type { Metadata } from "next";
import { DashboardOverview } from "@/components/app/DashboardOverview";
import { ExampleDataBanner } from "@/components/app/ModuleStateViews";
import { requireUser } from "@/lib/guards";
import { loadDashboardOverview } from "@/lib/modules/adapters/reports.server";
import { parseScenario } from "@/lib/modules/runtime";

export const metadata: Metadata = {
  title: "Inicio · MarkovLab",
  description: "Resumen consolidado del laboratorio de carteras, mercado y análisis de MarkovLab.",
};

/**
 * Página principal autenticada (`/app`). En producción muestra únicamente los módulos y datos
 * reales del usuario sin exponer fixtures; en vista local refleja las entregas F1–F7.
 */
export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<{ escenario?: string }>;
}) {
  const user = await requireUser();
  const { escenario } = await searchParams;
  const result = await loadDashboardOverview({
    actorId: user.id,
    userName: user.name,
    scenario: parseScenario(escenario),
  });

  return (
    <>
      {result.status === "ok" && result.provenance.isExample && (
        <ExampleDataBanner moduleName="Dashboard consolidado (F7)" />
      )}
      <DashboardOverview result={result} />
    </>
  );
}

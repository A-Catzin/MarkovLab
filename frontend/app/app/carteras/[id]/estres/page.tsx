import type { Metadata } from "next";
import Link from "next/link";
import { ExampleDataBanner } from "@/components/app/ModuleStateViews";
import { StressTestingView } from "@/components/app/StressTestingView";
import { requireUser } from "@/lib/guards";
import { loadStressTestingView } from "@/lib/modules/adapters/stress.server";
import { parseScenario } from "@/lib/modules/runtime";

export const metadata: Metadata = {
  title: "Escenarios de estrés · MarkovLab",
  description: "Comparación Base vs Estrés compartiendo horizonte, confianza y semilla.",
};

function parseOptionalNumber(raw?: string): number | undefined {
  if (raw === undefined) return undefined;
  if (raw.trim() === "") return Number.NaN;
  return Number(raw);
}

export default async function PortfolioStressPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ escenario?: string; preset?: string; retorno?: string; vol?: string; corr?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { escenario, preset, retorno, vol, corr } = await searchParams;
  const scenario = parseScenario(escenario);

  const result = await loadStressTestingView({
    actorId: user.id,
    portfolioId: id,
    presetId: preset,
    returnShift: parseOptionalNumber(retorno),
    volatilityMultiplier: parseOptionalNumber(vol),
    correlationShift: parseOptionalNumber(corr),
    scenario,
  });

  const viewKey = `${scenario}-${preset ?? "default"}-${retorno ?? ""}-${vol ?? ""}-${corr ?? ""}`;

  return (
    <>
      <p className="crumbs">
        <Link href="/app/carteras">Mis carteras</Link> / <Link href={`/app/carteras/${id}`}>Detalle</Link> / Escenarios de
        estrés
      </p>
      {result.status === "ok" && result.provenance.isExample && (
        <ExampleDataBanner moduleName="Escenarios de estrés (F3)" />
      )}
      <StressTestingView
        key={viewKey}
        result={result}
        basePath={`/app/carteras/${id}/estres`}
        currentScenario={scenario}
      />
    </>
  );
}
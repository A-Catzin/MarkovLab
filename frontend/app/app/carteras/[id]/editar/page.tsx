import type { Metadata } from "next";
import Link from "next/link";
import { ExampleDataBanner, ModuleStatePanel } from "@/components/app/ModuleStateViews";
import { PortfolioForm } from "@/components/app/PortfolioForm";
import { PortfolioVersionsPanel } from "@/components/app/PortfolioVersionsPanel";
import styles from "@/components/app/modules.module.css";
import { requireUser } from "@/lib/guards";
import { loadPortfolioEditView } from "@/lib/modules/adapters/portfolio-edit.server";
import { parseScenario } from "@/lib/modules/runtime";

export const metadata: Metadata = {
  title: "Editar y versionar cartera · MarkovLab",
  description: "Edición de composición, lista de versiones y duplicación sin alterar el original.",
};

export default async function EditPortfolioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ escenario?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { escenario } = await searchParams;
  const scenario = parseScenario(escenario);

  const result = await loadPortfolioEditView({
    actorId: user.id,
    portfolioId: id,
    scenario,
  });

  return (
    <div className={styles.viewRoot}>
      <p className="crumbs">
        <Link href="/app/carteras">Mis carteras</Link> / <Link href={`/app/carteras/${id}`}>Detalle</Link> / Edición y
        versiones
      </p>

      {result.status === "ok" && result.provenance.isExample && (
        <ExampleDataBanner moduleName="Edición y versiones de cartera (F2)" />
      )}

      <h1 className={styles.pageTitle}>
        {result.status === "ok" ? `Editar · ${result.data.portfolioName}` : "Edición y versiones de cartera"}
      </h1>

      {result.status !== "ok" ? (
        <ModuleStatePanel result={result} />
      ) : (
        <>
          <PortfolioForm
            assets={result.data.catalog}
            mode="edit"
            portfolioId={result.data.portfolioId}
            initialValues={{
              name: result.data.portfolioName,
              capital: result.data.capital,
              currency: result.data.currency,
              startDate: result.data.startDate,
              positions: result.data.positions,
            }}
            pendingBackend={result.data.pendingBackend}
            submitLabel={result.data.pendingBackend ? "Validar cambios (pendiente B3)" : "Guardar nueva versión"}
            cancelHref={`/app/carteras/${id}`}
          />
          <PortfolioVersionsPanel data={result.data} />
        </>
      )}
    </div>
  );
}

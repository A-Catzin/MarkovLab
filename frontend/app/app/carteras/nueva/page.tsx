import type { Metadata } from "next";
import Link from "next/link";
import { PortfolioForm } from "@/components/app/PortfolioForm";
import { requireUser } from "@/lib/guards";
import { getCatalogAssets, type CatalogAsset } from "@/lib/portfolios";

export const metadata: Metadata = {
  title: "Nueva cartera · MarkovLab",
  description: "Crea una cartera con los activos del catálogo.",
};

/** Formulario de nueva cartera, con los activos que tienen precios cargados. */
export default async function NewPortfolioPage() {
  const user = await requireUser();
  let assets: CatalogAsset[] | null = null;
  try {
    assets = await getCatalogAssets(user.id);
  } catch (error) {
    console.error("[carteras] no se pudo leer el catálogo:", error);
  }

  return (
    <>
      <p className="crumbs">
        <Link href="/app/carteras">Mis carteras</Link> / Nueva
      </p>
      <h1>Nueva cartera</h1>
      <p className="shell__lead">
        Elige los activos y cuánto de tu dinero va a cada uno. Los porcentajes tienen que sumar 100 %.
      </p>
      {assets === null ? (
        <p className="notice notice--error" role="alert">
          No pudimos leer el catálogo de activos porque el servidor no responde. Inténtalo en unos minutos.
        </p>
      ) : assets.length === 0 ? (
        <section className="empty">
          <h2>Todavía no hay activos</h2>
          <p>Para crear carteras, un admin tiene que cargar precios de al menos un activo.</p>
        </section>
      ) : (
        <PortfolioForm
          assets={assets.map((asset) => ({
            id: asset.id,
            label: `${asset.symbol} · ${asset.name} (${asset.market})`,
            currency: asset.currency,
          }))}
        />
      )}
    </>
  );
}

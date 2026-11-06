import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/guards";
import { STATUS_LABELS, formatMoney, getPortfolios, type Portfolio } from "@/lib/portfolios";

export const metadata: Metadata = {
  title: "Mis carteras · MarkovLab",
  description: "Tus carteras guardadas en MarkovLab.",
};

/** Lista de las carteras del usuario, de la más nueva a la más vieja. */
export default async function PortfoliosPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { deleted, error: actionError } = await searchParams;
  let portfolios: Portfolio[] | null = null;
  try {
    portfolios = await getPortfolios(user.id);
  } catch (error) {
    console.error("[carteras] no se pudieron leer:", error);
  }

  return (
    <>
      <div className="page-head">
        <h1>Mis carteras</h1>
        <Link className="button button--small" href="/app/carteras/nueva">
          Nueva cartera
        </Link>
      </div>
      {deleted && (
        <p className="notice" role="status">
          La cartera se borró.
        </p>
      )}
      {actionError && (
        <p className="notice notice--error" role="alert">
          No pudimos borrar la cartera. Inténtalo de nuevo.
        </p>
      )}

      {portfolios === null ? (
        <p className="notice notice--error" role="alert">
          No pudimos leer tus carteras porque el servidor no responde. Inténtalo en unos minutos.
        </p>
      ) : portfolios.length === 0 ? (
        <section className="empty" aria-labelledby="empty-title">
          <h2 id="empty-title">Todavía no tienes carteras</h2>
          <p>
            Una cartera es cómo repartes tu dinero entre varios activos: por ejemplo, 60 % en una acción y 40 % en otra.
            Guárdala para medir su riesgo cuando quieras.
          </p>
          <Link className="button empty__action" href="/app/carteras/nueva">
            Crear mi primera cartera
          </Link>
        </section>
      ) : (
        <ul className="pf-list">
          {portfolios.map((portfolio) => (
            <li key={portfolio.id}>
              <Link className="pf-card" href={`/app/carteras/${portfolio.id}`}>
                <span className="pf-card__name">{portfolio.name}</span>
                <span className="pf-card__capital">{formatMoney(portfolio.capital, portfolio.currency)}</span>
                <span className="pf-card__meta">
                  {portfolio.positions.length === 1 ? "1 activo" : `${portfolio.positions.length} activos`} ·{" "}
                  {portfolio.positions.map((p) => p.symbol).join(", ")} · {STATUS_LABELS[portfolio.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

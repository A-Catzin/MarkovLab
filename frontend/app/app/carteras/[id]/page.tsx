import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackendError } from "@/lib/backend";
import { requireUser } from "@/lib/guards";
import { STATUS_LABELS, formatMoney, formatWeight, getPortfolio, type Portfolio } from "@/lib/portfolios";
import { deletePortfolio } from "../actions";

export const metadata: Metadata = {
  title: "Cartera · MarkovLab",
  description: "Composición de una cartera guardada.",
};

/**
 * Detalle de una cartera del usuario: datos, composición (RF-31) y botón para borrarla.
 * Si la cartera no existe o es de otro usuario, responde 404.
 */
export default async function PortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let portfolio: Portfolio;
  try {
    portfolio = await getPortfolio(user.id, id);
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) notFound();
    console.error("[carteras] no se pudo leer:", error);
    return (
      <p className="notice notice--error" role="alert">
        No pudimos leer la cartera porque el servidor no responde. Inténtalo en unos minutos.
      </p>
    );
  }

  return (
    <>
      <p className="crumbs">
        <Link href="/app/carteras">Mis carteras</Link> / {portfolio.name}
      </p>
      <h1>{portfolio.name}</h1>
      <dl className="metrics metrics--compact">
        <div>
          <dt>Capital inicial</dt>
          <dd>{formatMoney(portfolio.capital, portfolio.currency)}</dd>
        </div>
        <div>
          <dt>Activos</dt>
          <dd>{portfolio.positions.length}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{STATUS_LABELS[portfolio.status]}</dd>
          <dd className="metrics__note">desde {portfolio.start_date}</dd>
        </div>
      </dl>

      <section className="panel" aria-labelledby="composition">
        <h2 id="composition">Composición</h2>
        {/* Barra apilada: cada tramo mide lo que pesa el activo en la cartera. */}
        <div className="pf-bar" role="img" aria-label={portfolio.positions.map((p) => `${p.symbol} ${formatWeight(p.weight)}`).join(", ")}>
          {portfolio.positions.map((position, i) => (
            <span
              key={position.asset_id}
              className={`pf-bar__part pf-bar__part--${i % 6}`}
              style={{ width: `${position.weight * 100}%` }}
            />
          ))}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">Activos de la cartera</caption>
            <thead>
              <tr>
                <th scope="col">Activo</th>
                <th scope="col">Nombre</th>
                <th scope="col">Mercado</th>
                <th scope="col" className="num">Peso</th>
                <th scope="col" className="num">Monto</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.positions.map((position, i) => (
                <tr key={position.asset_id}>
                  <th scope="row">
                    <span className={`pf-dot pf-bar__part--${i % 6}`} aria-hidden="true" />
                    {position.symbol}
                  </th>
                  <td>{position.name}</td>
                  <td>{position.market}</td>
                  <td className="num">{formatWeight(position.weight)}</td>
                  <td className="num">{formatMoney(portfolio.capital * position.weight, portfolio.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <form action={deletePortfolio} className="pf-delete">
        <input type="hidden" name="id" value={portfolio.id} />
        <button type="submit" className="button button--small button--quiet">
          Borrar cartera
        </button>
      </form>
    </>
  );
}

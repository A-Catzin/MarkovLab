import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackendError } from "@/lib/backend";
import { requireUser } from "@/lib/guards";
import { PortfolioHistoryChart } from "@/components/app/PortfolioHistoryChart";
import {
  STATUS_LABELS,
  formatMoney,
  formatWeight,
  getPortfolio,
  getPortfolioHistory,
  type Portfolio,
  type PortfolioHistory,
} from "@/lib/portfolios";
import { deletePortfolio } from "../actions";

export const metadata: Metadata = {
  title: "Cartera · MarkovLab",
  description: "Composición de una cartera guardada.",
};

/** Historia de la cartera, o el motivo por el que no se puede dibujar. */
async function loadHistory(actorId: string, id: string): Promise<PortfolioHistory | "insufficient" | "error"> {
  try {
    return await getPortfolioHistory(actorId, id);
  } catch (error) {
    if (error instanceof BackendError && error.status === 422) return "insufficient";
    console.error("[carteras] no se pudo leer la historia:", error);
    return "error";
  }
}

/**
 * Detalle de una cartera del usuario: datos, valor histórico, composición (RF-31) y botón
 * para borrarla. Si la cartera no existe o es de otro usuario, responde 404.
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

  const history = await loadHistory(user.id, id);

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

      {typeof history === "object" ? (
        <PortfolioHistoryChart
          points={history.points}
          anchorDate={history.anchor_date}
          capital={history.capital}
          currency={history.currency}
        />
      ) : (
        <p className={`notice ${history === "error" ? "notice--error" : ""}`} role="status">
          {history === "error"
            ? "No pudimos leer el valor histórico. Inténtalo en unos minutos."
            : "Todavía no hay precios suficientes de estos activos para dibujar su valor histórico."}
        </p>
      )}

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

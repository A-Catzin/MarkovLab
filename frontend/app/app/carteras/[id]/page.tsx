import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackendError } from "@/lib/backend";
import { requireUser } from "@/lib/guards";
import { isLocalFixturesEnabled } from "@/lib/modules/runtime";
import { PortfolioHistoryChart } from "@/components/app/PortfolioHistoryChart";
import { PortfolioSimulation } from "@/components/app/PortfolioSimulation";
import {
  STATUS_LABELS,
  currencyNote,
  formatMoney,
  formatWeight,
  getPortfolio,
  getPortfolioHistory,
  getSimulations,
  type Portfolio,
  type PortfolioHistory,
  type Simulation,
} from "@/lib/portfolios";
import { deletePortfolio } from "../actions";

export const metadata: Metadata = {
  title: "Cartera · MarkovLab",
  description: "Composición de una cartera guardada.",
};

/** Historia de la cartera, o el motivo por el que no se puede dibujar. */
async function loadHistory(
  actorId: string,
  id: string,
): Promise<PortfolioHistory | "insufficient" | "missing_rate" | "error"> {
  try {
    return await getPortfolioHistory(actorId, id);
  } catch (error) {
    if (error instanceof BackendError && error.code === "missing_exchange_rate") return "missing_rate";
    if (error instanceof BackendError && error.status === 422) return "insufficient";
    console.error("[carteras] no se pudo leer la historia:", error);
    return "error";
  }
}

/** Simulaciones guardadas; si no se pueden leer, la página sigue y el panel arranca vacío. */
async function loadSimulations(actorId: string, id: string): Promise<Simulation[]> {
  try {
    return await getSimulations(actorId, id);
  } catch (error) {
    console.error("[carteras] no se pudieron leer las simulaciones:", error);
    return [];
  }
}

/**
 * Detalle de una cartera del usuario: datos, valor histórico, simulación, composición (RF-31) y botón
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

  const showPreviewLinks = isLocalFixturesEnabled();
  const [history, simulations] = await Promise.all([loadHistory(user.id, id), loadSimulations(user.id, id)]);
  const note = currencyNote(portfolio);
  const historyMessage = {
    error: "No pudimos leer el valor histórico. Inténtalo en unos minutos.",
    insufficient: "Todavía no hay precios suficientes de estos activos para dibujar su valor histórico.",
    missing_rate: `Falta el tipo de cambio para valuar estos activos en ${portfolio.currency}. Pídele a un administrador que lo cargue.`,
  };

  return (
    <>
      <p className="crumbs">
        <Link href="/app/carteras">Mis carteras</Link> / {portfolio.name}
      </p>
      <div className="page-head">
        <h1>{portfolio.name}</h1>
        {showPreviewLinks && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={`/app/carteras/${portfolio.id}/editar`} className="button button--small button--quiet">
              Editar y versiones
            </Link>
            <Link href={`/app/carteras/${portfolio.id}/estres`} className="button button--small button--quiet">
              Escenarios de estrés
            </Link>
          </div>
        )}
      </div>
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
          currencyNote={note}
        />
      ) : (
        <p className={`notice ${history === "insufficient" ? "" : "notice--error"}`} role="status">
          {historyMessage[history]}
        </p>
      )}

      <PortfolioSimulation
        portfolioId={portfolio.id}
        capital={portfolio.capital}
        currency={portfolio.currency}
        previous={simulations}
        currencyNote={note}
      />

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
                <th scope="col">Mercado y moneda</th>
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
                  <td>
                    {position.market} · {position.currency}
                  </td>
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

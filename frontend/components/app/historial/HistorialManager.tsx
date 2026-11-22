"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  deleteBacktest,
  readBacktests,
  type RebalanceFrequency,
  type SavedBacktest,
} from "@/lib/backtesting";
import { formatDate, formatDateTime } from "@/lib/format";
import { HORIZON_OPTIONS, SAMPLE_ASSETS } from "@/lib/landing-data";
import {
  formatMoney,
  formatPercent,
  formatSignedPercent,
  readPortfolios,
  type Portfolio,
} from "@/lib/portfolios";
import { deleteSimulation, readSimulations, type SavedSimulation } from "@/lib/simulations";

const REBALANCE_LABELS: Record<RebalanceFrequency, string> = {
  monthly: "rebalanceo mensual",
  quarterly: "rebalanceo trimestral",
  annual: "rebalanceo anual",
  buy_and_hold: "comprar y mantener",
};

const HORIZON_LABELS: Record<number, string> = {
  252: "1 año",
  756: "3 años",
  1260: "5 años",
};

const horizonLabel = (days: number) => HORIZON_OPTIONS.find((option) => option.days === days)?.label ?? `${days} días`;

function weightsSummary(assets: Array<{ ticker: string; weight: number }>): string {
  return assets
    .filter((item) => item.weight > 0)
    .map((item) => `${item.ticker} ${item.weight} %`)
    .join(" · ");
}

function SimulationItem({ item, onDelete }: { item: SavedSimulation; onDelete: (id: string) => void }) {
  const weightsParam = item.weights.join(",");
  const repeatUrl = `/app/simulador?weights=${encodeURIComponent(weightsParam)}&capital=${item.capital}&name=${encodeURIComponent(item.name)}`;
  const summary = item.summary;

  return (
    <article className="ui-panel hist-item">
      <div className="hist-item__top">
        <div>
          <h3>{item.name}</h3>
          <p className="hist-item__meta">
            {formatDateTime(item.createdAt)} · {item.simulations.toLocaleString("es-MX")} escenarios ·{" "}
            {horizonLabel(item.horizon).toLowerCase()} · semilla {item.seed}
          </p>
        </div>
        <span className="ui-tag">Simulación</span>
      </div>

      <p className="hist-item__weights">{weightsSummary(item.weights.map((weight, index) => ({ ticker: SAMPLE_ASSETS[index]?.ticker ?? "", weight })))}</p>

      <dl className="hist-item__stats">
        <div>
          <dt>Capital</dt>
          <dd>{formatMoney(item.capital)}</dd>
        </div>
        <div>
          <dt>Punto medio</dt>
          <dd>{formatSignedPercent(summary.percentiles[50])}</dd>
        </div>
        <div>
          <dt>VaR {Math.round(summary.confidence * 100)} %</dt>
          <dd>{formatSignedPercent(-summary.valueAtRisk)}</dd>
        </div>
        <div>
          <dt>CVaR {Math.round(summary.confidence * 100)} %</dt>
          <dd>{formatSignedPercent(-summary.conditionalValueAtRisk)}</dd>
        </div>
        <div>
          <dt>Prob. de ganar</dt>
          <dd>{Math.round(summary.probabilityOfGain * 100)} %</dd>
        </div>
      </dl>

      <div className="hist-item__actions">
        <Link className="button button--small" href={repeatUrl}>
          Repetir
        </Link>
        <button className="link hist-item__danger" type="button" onClick={() => onDelete(item.id)}>
          Eliminar
        </button>
      </div>
    </article>
  );
}

function BacktestItem({ item, onDelete }: { item: SavedBacktest; onDelete: (id: string) => void }) {
  const pm = item.portfolioMetrics;
  const bm = item.benchmarkMetrics;

  return (
    <article className="ui-panel hist-item">
      <div className="hist-item__top">
        <div>
          <h3>{item.portfolioName}</h3>
          <p className="hist-item__meta">
            {formatDateTime(item.createdAt)} · {HORIZON_LABELS[item.horizonDays] ?? `${item.horizonDays} días`} ·{" "}
            {REBALANCE_LABELS[item.rebalanceFrequency]} · benchmark {item.benchmarkTicker}
          </p>
        </div>
        <span className="ui-tag">Backtesting</span>
      </div>

      <dl className="hist-item__stats">
        <div>
          <dt>Rendimiento</dt>
          <dd>{formatSignedPercent(pm.cumulativeReturn)}</dd>
        </div>
        <div>
          <dt>Capital final</dt>
          <dd>{formatMoney(pm.finalCapital, item.currency)}</dd>
        </div>
        <div>
          <dt>Sharpe</dt>
          <dd>{pm.sharpeRatio.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Máx. caída</dt>
          <dd>{formatSignedPercent(pm.maxDrawdown)}</dd>
        </div>
        <div>
          <dt>Índice ({item.benchmarkTicker})</dt>
          <dd>{formatSignedPercent(bm.cumulativeReturn)}</dd>
        </div>
      </dl>

      <div className="hist-item__actions">
        <Link className="button button--small button--secondary" href="/app/backtesting">
          Abrir backtesting
        </Link>
        <button className="link hist-item__danger" type="button" onClick={() => onDelete(item.id)}>
          Eliminar
        </button>
      </div>
    </article>
  );
}

function PortfolioItem({ item }: { item: Portfolio }) {
  return (
    <article className="ui-panel hist-item">
      <div className="hist-item__top">
        <div>
          <h3>{item.name}</h3>
          <p className="hist-item__meta">
            Creada el {formatDate(item.createdAt)} · {formatMoney(item.capital, item.currency)} · versión {item.version}
          </p>
        </div>
        <span className="ui-tag">Cartera</span>
      </div>

      <p className="hist-item__weights">{weightsSummary(item.assets)}</p>

      <div className="hist-item__actions">
        <Link className="button button--small button--secondary" href="/app/carteras">
          Abrir en carteras
        </Link>
      </div>
    </article>
  );
}

export function HistorialManager() {
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const [backtests, setBacktests] = useState<SavedBacktest[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setSimulations(readSimulations());
    setBacktests(readBacktests());
    setPortfolios(readPortfolios() ?? []);
  }, []);

  function showToast(message: string) {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  }

  function removeSimulation(id: string) {
    const name = simulations.find((item) => item.id === id)?.name;
    if (!window.confirm(`¿Eliminar la simulación "${name}"? Esta acción no se puede deshacer.`)) return;
    setSimulations(deleteSimulation(id));
    showToast("Simulación eliminada.");
  }

  function removeBacktest(id: string) {
    const name = backtests.find((item) => item.id === id)?.portfolioName;
    if (!window.confirm(`¿Eliminar el backtesting "${name}"? Esta acción no se puede deshacer.`)) return;
    setBacktests(deleteBacktest(id));
    showToast("Backtesting eliminado.");
  }

  const empty = simulations.length === 0 && backtests.length === 0 && portfolios.length === 0;

  return (
    <div className="hist">
      {toastMessage ? (
        <div className="portfolio-toast" role="status" aria-live="polite">
          <span>{toastMessage}</span>
        </div>
      ) : null}

      {empty ? (
        <div className="ui-panel hist-empty">
          <p className="ui-panel__name">Aún no hay nada guardado</p>
          <p className="muted">
            Las simulaciones y los backtesting que guardes aparecerán aquí, junto con tus carteras, para comparar
            decisiones y repetir resultados.
          </p>
          <div className="hist-empty__actions">
            <Link className="button" href="/app/simulador">
              Ir al simulador
            </Link>
            <Link className="button button--secondary" href="/app/carteras">
              Crear una cartera
            </Link>
          </div>
        </div>
      ) : (
        <>
          {simulations.length > 0 ? (
            <section className="hist-section" aria-labelledby="hist-simulaciones">
              <h2 id="hist-simulaciones">Simulaciones</h2>
              <ul className="hist-list">
                {simulations.map((item) => (
                  <li key={item.id}>
                    <SimulationItem item={item} onDelete={removeSimulation} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {backtests.length > 0 ? (
            <section className="hist-section" aria-labelledby="hist-backtesting">
              <h2 id="hist-backtesting">Backtesting</h2>
              <ul className="hist-list">
                {backtests.map((item) => (
                  <li key={item.id}>
                    <BacktestItem item={item} onDelete={removeBacktest} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {portfolios.length > 0 ? (
            <section className="hist-section" aria-labelledby="hist-carteras">
              <h2 id="hist-carteras">Carteras</h2>
              <ul className="hist-list">
                {portfolios.map((item) => (
                  <li key={item.id}>
                    <PortfolioItem item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <p className="hist-footnote">
        Todo se guarda en este navegador. Cuando la API de MarkovLab esté lista, el historial vivirá en la base de datos
        de tu cuenta.
      </p>
    </div>
  );
}

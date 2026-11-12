"use client";

import { useActionState } from "react";
import { simulatePortfolio, type SimulationFormState } from "@/app/app/carteras/actions";
import type { Simulation } from "@/lib/portfolios";

interface Props {
  portfolioId: string;
  capital: number;
  currency: string;
  /** Simulaciones guardadas, de la más nueva a la más vieja. */
  previous: Simulation[];
}

const HORIZONS = [
  { days: 21, label: "1 mes" },
  { days: 63, label: "3 meses" },
  { days: 252, label: "1 año" },
] as const;

const horizonLabel = (days: number) => HORIZONS.find((h) => h.days === days)?.label ?? `${days} días hábiles`;
const money = (value: number, currency: string) =>
  `${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
const percent = (value: number, signed = false) =>
  `${signed && value > 0 ? "+" : ""}${(value * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })} %`;
const confidenceLabel = (value: number) => `${Math.round(value * 100)} %`;
const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

/** Resultado de una simulación en dinero: el escenario típico, el rango y las pérdidas en los malos. */
function SimulationResult({ simulation, capital, currency }: { simulation: Simulation; capital: number; currency: string }) {
  const p = simulation.summary.percentiles;
  const tail = Math.round((1 - simulation.confidence) * 100);
  const at = (r: number) => capital * (1 + r);
  // Rango del 5 % al 95 % de los escenarios, con la mediana y el capital marcados en la barra.
  const low = p["5"];
  const high = p["95"];
  const span = Math.max(high - low, 1e-9);
  const pos = (r: number) => `${Math.min(100, Math.max(0, ((r - low) / span) * 100))}%`;

  return (
    <div className="sim-result">
      <p className="sim-result__lead">
        En {horizonLabel(simulation.horizon)}, el escenario típico deja la cartera en{" "}
        <strong>{money(at(p["50"]), currency)}</strong> <span className="sim-result__pct">({percent(p["50"], true)})</span>.
      </p>

      <div className="sim-range" aria-hidden="true">
        <div className="sim-range__track">
          <span className="sim-range__capital" style={{ left: pos(0) }} />
          <span className="sim-range__median" style={{ left: pos(p["50"]) }} />
        </div>
        <div className="sim-range__labels">
          <span>{money(at(low), currency)}</span>
          <span>{money(at(high), currency)}</span>
        </div>
      </div>
      <p className="sim-result__range">
        9 de cada 10 escenarios terminan entre {money(at(low), currency)} y {money(at(high), currency)}. La marca
        delgada es tu capital.
      </p>

      <dl className="metrics metrics--compact sim-result__metrics">
        <div>
          <dt>Pérdida máxima con {confidenceLabel(simulation.confidence)} de confianza (VaR)</dt>
          <dd>{money(capital * simulation.value_at_risk, currency)}</dd>
          <dd className="metrics__note">{percent(simulation.value_at_risk)} del capital</dd>
        </div>
        <div>
          <dt>Pérdida promedio en el peor {tail} % (CVaR)</dt>
          <dd>{money(capital * simulation.conditional_value_at_risk, currency)}</dd>
          <dd className="metrics__note">{percent(simulation.conditional_value_at_risk)} del capital</dd>
        </div>
        <div>
          <dt>Volatilidad diaria</dt>
          <dd>{percent(simulation.expected_volatility)}</dd>
          <dd className="metrics__note">cuánto se mueve en un día normal</dd>
        </div>
      </dl>

      <p className="sim-result__note">
        {simulation.summary.scenarios.toLocaleString("es-MX")} escenarios con precios del {shortDate(simulation.window.from)} al{" "}
        {shortDate(simulation.window.to)} ({simulation.observations.toLocaleString("es-MX")} días). Modelo {simulation.model},
        semilla {simulation.seed}. Sin conversión de moneda: cada activo rinde en la suya.
      </p>
    </div>
  );
}

/**
 * Panel "Simular": elige plazo y confianza, corre el Monte Carlo con los precios reales de la
 * base y muestra el resultado más reciente y las simulaciones anteriores.
 */
export function PortfolioSimulation({ portfolioId, capital, currency, previous }: Props) {
  const [state, formAction, pending] = useActionState<SimulationFormState, FormData>(simulatePortfolio, {
    simulation: null,
    error: null,
  });
  const latest = state.simulation ?? previous[0] ?? null;
  const history = previous.filter((s) => s.id !== latest?.id);

  return (
    <section className="panel" aria-labelledby="simulation-title">
      <h2 id="simulation-title">Simular</h2>
      <p className="panel__help">
        10,000 futuros posibles de la cartera, a partir de cómo se movieron sus activos en los últimos 5 años.
      </p>

      <form action={formAction} className="sim-form">
        <input type="hidden" name="id" value={portfolioId} />
        <fieldset className="sim-form__group">
          <legend>Plazo</legend>
          <div className="sim-form__options">
            {HORIZONS.map((h) => (
              <label key={h.days} className="sim-chip">
                <input type="radio" name="horizon" value={h.days} defaultChecked={h.days === 21} />
                <span>{h.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="sim-form__group">
          <legend>Confianza</legend>
          <div className="sim-form__options">
            {[0.95, 0.99].map((c) => (
              <label key={c} className="sim-chip">
                <input type="radio" name="confidence" value={c} defaultChecked={c === 0.95} />
                <span>{confidenceLabel(c)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="button button--small" disabled={pending} aria-busy={pending}>
          {pending ? "Simulando…" : "Simular"}
        </button>
      </form>

      {state.error && (
        <p className="notice notice--error" role="alert">
          {state.error}
        </p>
      )}

      <div aria-live="polite">
        {latest ? (
          <SimulationResult simulation={latest} capital={capital} currency={currency} />
        ) : (
          !state.error && <p className="sim-empty">Todavía no has simulado esta cartera.</p>
        )}
      </div>

      {history.length > 0 && (
        <details className="sim-history">
          <summary>Simulaciones anteriores ({history.length})</summary>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Plazo</th>
                  <th scope="col" className="num">
                    Confianza
                  </th>
                  <th scope="col" className="num">
                    Típico
                  </th>
                  <th scope="col" className="num">
                    VaR
                  </th>
                  <th scope="col" className="num">
                    CVaR
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id}>
                    <td>{s.created_at ? shortDate(s.created_at) : "—"}</td>
                    <td>{horizonLabel(s.horizon)}</td>
                    <td className="num">{confidenceLabel(s.confidence)}</td>
                    <td className="num">{percent(s.summary.percentiles["50"], true)}</td>
                    <td className="num">{money(capital * s.value_at_risk, currency)}</td>
                    <td className="num">{money(capital * s.conditional_value_at_risk, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

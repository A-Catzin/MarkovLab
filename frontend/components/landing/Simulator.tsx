"use client";

import { useState } from "react";
import { runDemo, type DemoResult } from "@/lib/demo";
import { DEFAULT_REQUEST, HORIZON_OPTIONS, SAMPLE_ASSETS } from "@/lib/landing-data";

type Result = DemoResult;

const percent = (value: number, digits = 1) =>
  `${(value * 100).toLocaleString("es-MX", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

const horizonLabel = (days: number) => HORIZON_OPTIONS.find((o) => o.days === days)?.label ?? `${days} días`;

function Histogram({ result }: { result: Result }) {
  const { counts, low, width } = result.histogram;
  const max = Math.max(...counts);
  const threshold = -result.summary.valueAtRisk;
  const barWidth = 100 / counts.length;
  return (
    <>
      <svg className="ui-hist" viewBox="0 0 100 40" preserveAspectRatio="none" role="img"
        aria-label={`Distribución de ${result.summary.scenarios.toLocaleString("es-MX")} resultados; las barras oscuras quedan por debajo del VaR`}>
        {counts.map((count, i) => {
          const h = (count / max) * 40;
          const binTop = low + (i + 1) * width;
          return (
            <rect
              key={i}
              x={i * barWidth + 0.15}
              y={40 - h}
              width={barWidth - 0.3}
              height={h}
              fill={binTop <= threshold ? "var(--accent)" : "var(--field-strong)"}
            />
          );
        })}
      </svg>
      <div className="ui-hist__legend">
        <span>Peor {percent(result.summary.worst)}</span>
        <span>Mediana {percent(result.summary.percentiles[50])}</span>
        <span>Mejor {percent(result.summary.best)}</span>
      </div>
    </>
  );
}

export function Simulator({ initial }: { initial: Result }) {
  const [weights, setWeights] = useState<number[]>(DEFAULT_REQUEST.weights);
  const [horizon, setHorizon] = useState(DEFAULT_REQUEST.horizon);
  const [seed, setSeed] = useState(DEFAULT_REQUEST.seed);
  const [confidence, setConfidence] = useState(DEFAULT_REQUEST.confidence);
  const [result, setResult] = useState<Result>(initial);

  const total = weights.reduce((a, b) => a + b, 0);
  const valid = total === 100 && Number.isInteger(seed) && seed >= 0;

  function run() {
    if (!valid) return;
    const request = { weights, horizon, seed, confidence, simulations: DEFAULT_REQUEST.simulations };
    const start = performance.now();
    const next = runDemo(request);
    setResult({ ...next, elapsedMs: performance.now() - start });
  }

  const pending = { weights, horizon, seed, confidence };
  const { summary, request } = result;

  return (
    <section className="sim grid section" id="simulador" aria-labelledby="simulador-title">
      <h2 className="sim__title" id="simulador-title" data-reveal>
        Una simulación
      </h2>
      <p className="sim__intro" data-reveal style={{ ["--i" as string]: 1 }}>
        Mueva los pesos de la cartera de ejemplo y ejecute: su navegador calcula 10,000 escenarios con el mismo
        modelo que el motor Julia.
      </p>

      <p className="sim__state sim__state--first" aria-hidden="true">
        Pedida
      </p>
      <div className="sim__row sim__row--first" data-state="Pedida" data-reveal style={{ ["--i" as string]: 2 }}>
        <div className="ui-panel" data-ui>
          <div className="ui-panel__top">
            <span className="ui-panel__name">Cartera de ejemplo</span>
            <span className="ui-tag">En cola</span>
          </div>
          <table className="ui-table">
            <thead>
              <tr>
                <th scope="col">Activo</th>
                <th scope="col">Rend. anual</th>
                <th scope="col">Volatilidad</th>
                <th scope="col">Peso</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ASSETS.map((asset, i) => (
                <tr key={asset.ticker}>
                  <td>
                    {asset.ticker} <span className="muted">{asset.name}</span>
                  </td>
                  <td>{percent(asset.annualReturn)}</td>
                  <td>{percent(asset.annualVolatility)}</td>
                  <td>{pending.weights[i]} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="sim__state" aria-hidden="true">
        Ajustada
      </p>
      <div className="sim__row" data-state="Ajustada" data-reveal>
        <form
          className="ui-panel"
          data-ui
          onSubmit={(event) => {
            event.preventDefault();
            run();
          }}
        >
          <div className="ui-panel__top">
            <span className="ui-panel__name">Pesos y parámetros</span>
            <span className={`ui-tag ${total === 100 ? "" : "ui-sum--bad"}`} aria-live="polite">
              Suma {total} %
            </span>
          </div>
          <div className="ui-controls">
            {SAMPLE_ASSETS.map((asset, i) => (
              <label className="ui-weight" key={asset.ticker}>
                <span>{asset.ticker}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={weights[i]}
                  onChange={(event) => {
                    const next = [...weights];
                    next[i] = Number(event.target.value);
                    setWeights(next);
                  }}
                  aria-label={`Peso de ${asset.name}`}
                />
                <output>{weights[i]} %</output>
              </label>
            ))}
          </div>
          <div className="ui-fields">
            <label>
              Horizonte
              <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
                {HORIZON_OPTIONS.map((option) => (
                  <option key={option.days} value={option.days}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Confianza
              <select value={confidence} onChange={(event) => setConfidence(Number(event.target.value))}>
                <option value={0.9}>90 %</option>
                <option value={0.95}>95 %</option>
                <option value={0.99}>99 %</option>
              </select>
            </label>
            <label>
              Semilla
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={Number.isNaN(seed) ? "" : seed}
                onChange={(event) => setSeed(Number.parseInt(event.target.value, 10))}
              />
            </label>
          </div>
          <div className="ui-actions">
            <span className="muted">
              {total === 100
                ? "Los pesos suman 100 %."
                : total < 100
                  ? `Faltan ${100 - total} puntos para llegar a 100 %.`
                  : `Sobran ${total - 100} puntos: los pesos deben sumar 100 %.`}
            </span>
            <button className="button" type="submit" disabled={!valid}>
              Ejecutar simulación
            </button>
          </div>
        </form>
      </div>

      <p className="sim__state" aria-hidden="true">
        Resuelta
      </p>
      <div className="sim__row" data-state="Resuelta" data-reveal>
        <div className="ui-panel" data-ui aria-live="polite">
          <div className="ui-panel__top">
            <span className="ui-panel__name">
              {horizonLabel(request.horizon)}, semilla {request.seed}
            </span>
            <span className="ui-tag ui-tag--done">
              {result.elapsedMs === null ? "Resuelta" : `Resuelta en ${Math.max(1, Math.round(result.elapsedMs))} ms`}
            </span>
          </div>
          <div className="ui-figures">
            <div>
              <span>VaR al {Math.round(request.confidence * 100)} %</span>
              <strong>{percent(summary.valueAtRisk)}</strong>
            </div>
            <div>
              <span>CVaR al {Math.round(request.confidence * 100)} %</span>
              <strong>{percent(summary.conditionalValueAtRisk)}</strong>
            </div>
          </div>
          <Histogram result={result} />
          <p className="caption">
            Con {Math.round(request.confidence * 100)} % de confianza, la cartera no pierde más de{" "}
            {percent(summary.valueAtRisk)} en {horizonLabel(request.horizon).toLowerCase()}; en el{" "}
            {100 - Math.round(request.confidence * 100)} % peor, pierde {percent(summary.conditionalValueAtRisk)} en
            promedio.
          </p>
        </div>
      </div>

      <div className="sim__aside" data-reveal style={{ ["--i" as string]: 3 }}>
        <p>
          Los datos de la cartera son de ejemplo, no cotizaciones reales. El VaR y el CVaR se expresan como pérdidas.
        </p>
        <p>
          Con la misma semilla verá siempre el mismo resultado: así funciona la reproducibilidad del motor.
        </p>
      </div>
    </section>
  );
}

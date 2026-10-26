"use client";

import { useState } from "react";
import { runDemo, type DemoResult } from "@/lib/demo";
import { DEFAULT_CAPITAL, DEFAULT_REQUEST, HORIZON_OPTIONS, SAMPLE_ASSETS } from "@/lib/landing-data";

type Result = DemoResult & { capital: number };

const MAX_CAPITAL = 1_000_000_000;

const percent = (value: number, digits = 1) =>
  `${(value * 100).toLocaleString("es-MX", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

/** Porcentaje con signo explícito (+16.0 % o −5.5 %), para que se lea como ganancia o pérdida. */
const signedPercent = (value: number) => `${value >= 0 ? "+" : "−"}${percent(Math.abs(value))}`;

const money = (value: number) =>
  value.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

const horizonLabel = (days: number) => HORIZON_OPTIONS.find((o) => o.days === days)?.label ?? `${days} días`;

/** Convierte el nivel de confianza en una frecuencia fácil de leer: 0.9 → 10 ("1 de cada 10"). */
const oneIn = (confidence: number) => Math.round(1 / (1 - confidence));

function Histogram({ result }: { result: Result }) {
  const { counts, low, width } = result.histogram;
  const max = Math.max(...counts);
  const threshold = -result.summary.valueAtRisk;
  const barWidth = 100 / counts.length;
  const worstShare = oneIn(result.request.confidence);
  return (
    <>
      <p className="ui-hist__title">Cómo se repartieron los {result.summary.scenarios.toLocaleString("es-MX")} futuros</p>
      <svg
        className="ui-hist"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Histograma de ${result.summary.scenarios.toLocaleString("es-MX")} resultados simulados; en azul claro, el peor 1 de cada ${worstShare}`}
      >
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
        <span>Peor futuro {signedPercent(result.summary.worst)}</span>
        <span>Punto medio {signedPercent(result.summary.percentiles[50])}</span>
        <span>Mejor futuro {signedPercent(result.summary.best)}</span>
      </div>
      <p className="ui-hist__help">
        Cada barra agrupa futuros con un resultado parecido: cuanto más alta, más veces salió. Las barras en azul claro
        son el peor 1 de cada {worstShare}.
      </p>
    </>
  );
}

/** "Ganas $X" o "Pierdes $X" según el signo del rendimiento. */
const gainOrLoss = (capital: number, value: number) =>
  value >= 0 ? `Ganas ${money(capital * value)}` : `Pierdes ${money(capital * -value)}`;

function ResultFigures({ result }: { result: Result }) {
  const { summary, request, capital } = result;
  const n = oneIn(request.confidence);
  const level = Math.round(request.confidence * 100);
  const median = summary.percentiles[50];
  const best = summary.percentiles[95];
  const gainChance = Math.round(summary.probabilityOfGain * 100);
  const var_ = summary.valueAtRisk;
  const cvar = summary.conditionalValueAtRisk;
  return (
    <div className="ui-groups">
      <section className="ui-group" aria-label="Lo que podrías ganar">
        <p className="ui-group__title">Lo que podrías ganar</p>
        <div className="ui-figure">
          <span>Lo más probable</span>
          <strong>Terminas con {money(capital * (1 + median))}</strong>
          <small>
            {gainOrLoss(capital, median)} ({signedPercent(median)}). La mitad de los futuros termina por encima de esta
            cifra y la otra mitad por debajo (mediana).
          </small>
        </div>
        <div className="ui-figure">
          <span>Probabilidad de ganar</span>
          <strong>{gainChance} de cada 100 futuros</strong>
          <small>terminan con más dinero del que invertiste.</small>
        </div>
        <div className="ui-figure">
          <span>En los mejores casos (1 de cada 20)</span>
          <strong>{best >= 0 ? `Ganas ${money(capital * best)} o más` : `Pierdes menos de ${money(capital * -best)}`}</strong>
          <small>{signedPercent(best)} o mejor (percentil 95).</small>
        </div>
      </section>

      <section className="ui-group" aria-label="Lo que podrías perder">
        <p className="ui-group__title">Lo que podrías perder</p>
        <div className="ui-figure">
          <span>
            Casi siempre ({n - 1} de cada {n} futuros)
          </span>
          <strong>
            {var_ > 0 ? `Pierdes menos de ${money(capital * var_)}` : `Ganas al menos ${money(capital * -var_)}`}
          </strong>
          <small>
            {signedPercent(-var_)}. Es el límite donde empieza el peor 1 de cada {n} (VaR al {level} %).
          </small>
        </div>
        <div className="ui-figure">
          <span>En el peor 1 de cada {n}</span>
          <strong>
            {cvar > 0 ? `Pierdes ${money(capital * cvar)} en promedio` : `Ganas ${money(capital * -cvar)} en promedio`}
          </strong>
          <small>
            {signedPercent(-cvar)}. Es más que el límite anterior porque promedia solo los futuros que lo superan
            (CVaR al {level} %).
          </small>
        </div>
      </section>
    </div>
  );
}

export function Simulator({ initial }: { initial: DemoResult }) {
  const [weights, setWeights] = useState<number[]>(DEFAULT_REQUEST.weights);
  const [horizon, setHorizon] = useState(DEFAULT_REQUEST.horizon);
  const [seed, setSeed] = useState(DEFAULT_REQUEST.seed);
  const [confidence, setConfidence] = useState(DEFAULT_REQUEST.confidence);
  const [capital, setCapital] = useState(DEFAULT_CAPITAL);
  const [result, setResult] = useState<Result>({ ...initial, capital: DEFAULT_CAPITAL });

  const total = weights.reduce((a, b) => a + b, 0);
  const capitalValid = Number.isFinite(capital) && capital > 0 && capital <= MAX_CAPITAL;
  const valid = total === 100 && Number.isInteger(seed) && seed >= 0 && capitalValid;

  function run() {
    if (!valid) return;
    const request = { weights, horizon, seed, confidence, simulations: DEFAULT_REQUEST.simulations };
    const start = performance.now();
    const next = runDemo(request);
    setResult({ ...next, capital, elapsedMs: performance.now() - start });
  }

  const { request } = result;
  const n = oneIn(request.confidence);

  let hint: string;
  if (!capitalValid) hint = "Escribe un monto mayor que cero.";
  else if (total === 100) hint = "Repartiste el 100 % de tu dinero.";
  else if (total < 100) hint = `Te falta repartir ${100 - total} % de tu dinero.`;
  else hint = `Te pasaste por ${total - 100} %: baja alguna de las partes.`;

  return (
    <section className="sim grid section" id="simulador" aria-labelledby="simulador-title">
      <h2 className="sim__title" id="simulador-title" data-reveal>
        Prueba una cartera
      </h2>
      <p className="sim__intro" data-reveal style={{ ["--i" as string]: 1 }}>
        Decide cómo repartir tu dinero entre cuatro empresas y la página imagina 10,000 futuros posibles para ver
        cuánto podrías ganar o perder. Usa el mismo modelo que el motor de MarkovLab.
      </p>

      <p className="sim__state sim__state--first" aria-hidden="true">
        La cartera
      </p>
      <div className="sim__row sim__row--first" data-state="La cartera" data-reveal style={{ ["--i" as string]: 2 }}>
        <div className="ui-panel" data-ui>
          <div className="ui-panel__top">
            <span className="ui-panel__name">Cuatro empresas de ejemplo</span>
            <span className="ui-tag">Datos de ejemplo</span>
          </div>
          <table className="ui-table">
            <thead>
              <tr>
                <th scope="col">Empresa</th>
                <th scope="col">Gana al año</th>
                <th scope="col">Cuánto varía</th>
                <th scope="col">Tu parte</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ASSETS.map((asset, i) => (
                <tr key={asset.ticker}>
                  <td>
                    {asset.ticker} <span className="muted">{asset.name}</span>
                  </td>
                  <td>{percent(asset.annualReturn)}</td>
                  <td>±{percent(asset.annualVolatility)}</td>
                  <td>{weights[i]} %</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ui-note">
            &ldquo;Gana al año&rdquo; es la ganancia típica; &ldquo;Cuánto varía&rdquo; indica qué tanto sube y baja
            en un año normal (volatilidad).
          </p>
        </div>
      </div>

      <p className="sim__state" aria-hidden="true">
        Tus ajustes
      </p>
      <div className="sim__row" data-state="Tus ajustes" data-reveal>
        <form
          className="ui-panel"
          data-ui
          onSubmit={(event) => {
            event.preventDefault();
            run();
          }}
        >
          <div className="ui-panel__top">
            <span className="ui-panel__name">Reparte tu dinero</span>
            <span className={`ui-tag ${total === 100 ? "" : "ui-sum--bad"}`} aria-live="polite">
              Repartido: {total} %
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
                  aria-label={`Parte de tu dinero en ${asset.name}`}
                />
                <output>{weights[i]} %</output>
              </label>
            ))}
          </div>
          <div className="ui-fields">
            <label>
              Monto a invertir (MXN)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_CAPITAL}
                step="any"
                value={Number.isNaN(capital) ? "" : capital}
                onChange={(event) => setCapital(Number.parseFloat(event.target.value))}
              />
            </label>
            <label>
              Plazo
              <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))}>
                {HORIZON_OPTIONS.map((option) => (
                  <option key={option.days} value={option.days}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Peores casos a medir
              <select value={confidence} onChange={(event) => setConfidence(Number(event.target.value))}>
                <option value={0.9}>1 de cada 10</option>
                <option value={0.95}>1 de cada 20</option>
                <option value={0.99}>1 de cada 100</option>
              </select>
            </label>
            <label>
              Número de prueba (semilla)
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
            <span className="muted" aria-live="polite">
              {hint}
            </span>
            <button className="button" type="submit" disabled={!valid}>
              Simular 10,000 futuros
            </button>
          </div>
        </form>
      </div>

      <p className="sim__state" aria-hidden="true">
        El resultado
      </p>
      <div className="sim__row" data-state="El resultado" data-reveal>
        <div className="ui-panel" data-ui aria-live="polite">
          <div className="ui-panel__top">
            <span className="ui-panel__name">
              Si inviertes {money(result.capital)} a {horizonLabel(request.horizon).toLowerCase()}
            </span>
            <span className="ui-tag ui-tag--done">
              {result.elapsedMs === null ? "Listo" : `Listo en ${Math.max(1, Math.round(result.elapsedMs))} ms`}
            </span>
          </div>
          <ResultFigures result={result} />
          <Histogram result={result} />
          <p className="caption">
            En resumen: invirtiendo {money(result.capital)} a {horizonLabel(request.horizon).toLowerCase()}, lo más
            probable es{" "}
            {result.summary.percentiles[50] >= 0
              ? `ganar ${money(result.capital * result.summary.percentiles[50])}`
              : `perder ${money(result.capital * -result.summary.percentiles[50])}`}
            ;{" "}
            {Math.round(result.summary.probabilityOfGain * 100)} de cada 100 futuros terminan con ganancia y{" "}
            {result.summary.valueAtRisk > 0
              ? `en ${n - 1} de cada ${n} pierdes menos de ${money(result.capital * result.summary.valueAtRisk)}.`
              : `en ${n - 1} de cada ${n} ganas al menos ${money(result.capital * -result.summary.valueAtRisk)}.`}
          </p>
        </div>
      </div>

      <div className="sim__aside" data-reveal style={{ ["--i" as string]: 3 }}>
        <p>
          Las cifras de las cuatro empresas son de ejemplo, no precios reales, y nada de esto es una recomendación de
          inversión: el futuro real puede salir distinto.
        </p>
        <p>
          El número de prueba funciona como una partida guardada: si repites el mismo número con los mismos ajustes,
          obtienes exactamente el mismo resultado.
        </p>
      </div>
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPercent, formatRatio } from "@/lib/formatters";
import type { AdapterResult, ValidationIssue, ViewScenario } from "@/lib/modules/runtime";
import type { BacktestRunRecord, BacktestingData } from "@/lib/modules/types";
import { validateBacktestWindows } from "@/lib/modules/validators";
import { ErrorSummary, LoadingSkeletonPanel, ModuleStatePanel, ProvenanceStrip } from "./ModuleStateViews";
import styles from "./modules.module.css";

function BacktestCurveChart({ run }: { run: BacktestRunRecord }) {
  const vals = run.curve.flatMap((p) =>
    [p.strategyIndex, p.benchmarkIndex].filter((v): v is number => v !== null),
  );
  const minVal = Math.floor((Math.min(...vals) - 3) / 5) * 5;
  const maxVal = Math.ceil((Math.max(...vals) + 3) / 5) * 5;
  const span = Math.max(10, maxVal - minVal);

  const w = 720;
  const h = 235;
  const padL = 48;
  const padR = 20;
  const padT = 22;
  const padB = 34;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const toX = (idx: number) => padL + (run.curve.length <= 1 ? 0 : (idx / (run.curve.length - 1)) * innerW);
  const toY = (val: number) => padT + innerH - ((val - minVal) / span) * innerH;
  const yTicks = [0, 0.33, 0.67, 1].map((f) => Math.round(minVal + span * f));

  const firstEvalIndex = run.curve.findIndex((p) => p.phase === "evaluation");
  const lastConfigIndex = firstEvalIndex > 0 ? firstEvalIndex - 1 : 0;
  const splitX = toX(lastConfigIndex);

  const stratPath = run.curve
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.strategyIndex).toFixed(1)}`)
    .join(" ");

  const benchPath = run.benchmarkSymbol
    ? run.curve
        .map((p, i) =>
          p.benchmarkIndex === null
            ? null
            : `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.benchmarkIndex).toFixed(1)}`,
        )
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <section className="panel" aria-labelledby="bt-chart-title">
      <div className={styles.panelHeader}>
        <h2 id="bt-chart-title">Evolución acumulada: configuración vs evaluación fuera de muestra</h2>
        <span className={styles.panelMeta}>
          Zona sombreada: configuración ({run.configFrom} a {run.configTo}) · Zona clara: evaluación ({run.evalFrom} a{" "}
          {run.evalTo})
        </span>
      </div>

      <div className={styles.chartLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ background: "#e2b04a" }} aria-hidden="true" />{" "}
          {run.strategyName}
        </span>
        {run.benchmarkSymbol && (
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ borderTop: "2px dashed #6ea8fe" }} aria-hidden="true" />{" "}
            Benchmark ({run.benchmarkSymbol})
          </span>
        )}
      </div>

      <figure className={styles.chartFrame}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className={styles.chartSvg}
          role="img"
          aria-label={`Curva de backtesting separando configuración (${run.configFrom} a ${run.configTo}) de evaluación (${run.evalFrom} a ${run.evalTo})`}
        >
          <rect
            x={padL}
            y={padT}
            width={Math.max(0, splitX - padL)}
            height={innerH}
            fill="rgb(45 79 140 / 16%)"
          />
          {yTicks.map((tick) => {
            const y = toY(tick);
            return (
              <g key={tick}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--surface-2)" strokeWidth={1} />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
                  {tick}
                </text>
              </g>
            );
          })}
          <line x1={splitX} x2={splitX} y1={padT} y2={h - padB} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth={1.5} />
          <text x={splitX + 6} y={padT + 14} fontSize="12" fill="var(--accent)">
            Inicio fuera de muestra ({run.evalFrom})
          </text>
          <path d={stratPath} fill="none" stroke="#e2b04a" strokeWidth={2.2} />
          {benchPath && <path d={benchPath} fill="none" stroke="#6ea8fe" strokeWidth={2} strokeDasharray="6 4" />}
          {[0, lastConfigIndex, run.curve.length - 1]
            .filter((idx, i, arr) => idx >= 0 && arr.indexOf(idx) === i)
            .map((idx) => (
              <text key={idx} x={toX(idx)} y={h - 10} textAnchor={idx === 0 ? "start" : idx === run.curve.length - 1 ? "end" : "middle"} fontSize="12" fill="var(--muted)">
                {run.curve[idx].date}
              </text>
            ))}
        </svg>
      </figure>

      <details className={styles.chartDetails}>
        <summary>Ver puntos exactos de configuración y evaluación</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Etapa</th>
                <th scope="col" className="num">Estrategia (índice)</th>
                {run.benchmarkSymbol && <th scope="col" className="num">Benchmark ({run.benchmarkSymbol})</th>}
              </tr>
            </thead>
            <tbody>
              {run.curve.map((pt) => (
                <tr key={pt.date}>
                  <th scope="row">{pt.date}</th>
                  <td>{pt.phase === "config" ? "Configuración" : "Fuera de muestra"}</td>
                  <td className="num">{formatRatio(pt.strategyIndex, 2)}</td>
                  {run.benchmarkSymbol && <td className="num">{formatRatio(pt.benchmarkIndex, 2)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function BacktestingView({
  result,
  basePath,
  currentScenario,
}: {
  result: AdapterResult<BacktestingData>;
  basePath: string;
  currentScenario: ViewScenario;
}) {
  const router = useRouter();
  const initialRun =
    result.status === "ok"
      ? result.data.runs.find((r) => r.id === result.data.activeRunId) ?? result.data.runs[0]
      : null;

  const [activeRunId, setActiveRunId] = useState(initialRun?.id ?? "bt-1");
  const [configFrom, setConfigFrom] = useState(initialRun?.configFrom ?? "2022-01-03");
  const [configTo, setConfigTo] = useState(initialRun?.configTo ?? "2024-12-31");
  const [evalFrom, setEvalFrom] = useState(initialRun?.evalFrom ?? "2025-01-02");
  const [evalTo, setEvalTo] = useState(initialRun?.evalTo ?? "2026-10-30");
  const [benchmark, setBenchmark] = useState(initialRun?.benchmarkSymbol ?? "SP500");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [runNotice, setRunNotice] = useState<string | null>(null);

  if (result.status === "not_integrated") {
    return (
      <div className={styles.viewRoot}>
        <h1 className={styles.pageTitle}>Backtesting de estrategias (RF-49 a RF-53)</h1>
        <ModuleStatePanel result={result} />
      </div>
    );
  }

  function handleValidateWindows(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateBacktestWindows({ configFrom, configTo, evalFrom, evalTo });
    if (validation.length > 0) {
      setIssues(validation);
      setRunNotice(null);
      setFocusKey((k) => k + 1);
      return;
    }
    setIssues([]);
    setRunNotice(
      "Ventanas válidas sin fuga temporal (configuración termina antes del inicio de evaluación). La ejecución persistida depende del backend B7.",
    );
  }

  const activeRun =
    result.status === "ok"
      ? result.data.runs.find((r) => r.id === activeRunId) ?? result.data.runs[0]
      : null;

  return (
    <div className={styles.viewRoot}>
      <div className={styles.pageHeadMeta}>
        <div>
          <h1 className={styles.pageTitle}>Backtesting de estrategias fuera de muestra</h1>
          <p className={styles.pageLead}>
            Separa estrictamente la ventana usada para calibrar la estrategia de la ventana histórica de evaluación, con
            comparación opcional contra benchmark e historial de ejecuciones guardadas.
          </p>
        </div>
      </div>

      {currentScenario === "cargando" ? (
        <div style={{ marginTop: 20 }}>
          <LoadingSkeletonPanel title="Curva y métricas fuera de muestra" />
        </div>
      ) : result.status !== "ok" || !activeRun ? (
        <ModuleStatePanel
          result={result.status === "ok" ? { status: "empty", title: "Sin ejecuciones", message: "No hay corridas." } : result}
          onRetry={() => router.push(basePath)}
        />
      ) : (
        <>
          <ProvenanceStrip provenance={result.provenance} />

          <section className={styles.panelCard} style={{ marginTop: 20 }} aria-labelledby="bt-config-title">
            <div className={styles.panelHeader}>
              <h2 id="bt-config-title">Separación de ventanas y parámetros (RF-49 y RF-50)</h2>
              <span className={styles.panelMeta}>{activeRun.rebalanceLabel}</span>
            </div>

            <form onSubmit={handleValidateWindows} noValidate>
              <div className={styles.splitGridEqual} style={{ marginTop: 8 }}>
                <fieldset style={{ border: "1px solid var(--surface-2)", borderRadius: 6, padding: 14 }}>
                  <legend style={{ paddingInline: 6, color: "var(--muted)", fontSize: "0.875rem" }}>
                    1. Período de configuración (entrenamiento)
                  </legend>
                  <div className={styles.toolbar}>
                    <label className="field" htmlFor="bt-config-from">
                      <span>Inicio configuración</span>
                      <input
                        id="bt-config-from"
                        type="date"
                        value={configFrom}
                        onChange={(e) => setConfigFrom(e.target.value)}
                      />
                    </label>
                    <label className="field" htmlFor="bt-config-to">
                      <span>Fin configuración</span>
                      <input
                        id="bt-config-to"
                        type="date"
                        value={configTo}
                        onChange={(e) => setConfigTo(e.target.value)}
                      />
                    </label>
                  </div>
                </fieldset>

                <fieldset style={{ border: "1px solid var(--accent)", borderRadius: 6, padding: 14 }}>
                  <legend style={{ paddingInline: 6, color: "var(--accent)", fontSize: "0.875rem" }}>
                    2. Período de evaluación (fuera de muestra)
                  </legend>
                  <div className={styles.toolbar}>
                    <label className="field" htmlFor="bt-eval-from">
                      <span>Inicio evaluación</span>
                      <input
                        id="bt-eval-from"
                        type="date"
                        value={evalFrom}
                        onChange={(e) => setEvalFrom(e.target.value)}
                      />
                    </label>
                    <label className="field" htmlFor="bt-eval-to">
                      <span>Fin evaluación</span>
                      <input
                        id="bt-eval-to"
                        type="date"
                        value={evalTo}
                        onChange={(e) => setEvalTo(e.target.value)}
                      />
                    </label>
                  </div>
                </fieldset>
              </div>

              <div className={styles.toolbar} style={{ marginTop: 14 }}>
                <label className="field" htmlFor="bt-benchmark">
                  <span>Benchmark opcional (RF-52)</span>
                  <select id="bt-benchmark" value={benchmark} onChange={(e) => setBenchmark(e.target.value)}>
                    {result.data.benchmarks.map((item) => (
                      <option key={item.symbol} value={item.symbol}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={styles.toolbarActions}>
                  <button type="submit" className="button button--small">
                    Validar separación de ventanas
                  </button>
                </div>
              </div>
            </form>

            <ErrorSummary issues={issues} focusKey={focusKey} />
            {runNotice && (
              <p className="notice" role="status">
                {runNotice}
              </p>
            )}
          </section>

          <dl className={styles.kpiStrip} aria-label="Métricas fuera de muestra">
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Retorno acumulado (OOS)</dt>
              <dd className={styles.kpiLeadValue}>
                {formatPercent(activeRun.strategyMetrics.cumulativeReturn, { signed: true })}
              </dd>
              <dd className={styles.kpiSub}>
                {activeRun.benchmarkMetrics
                  ? `Benchmark ${activeRun.benchmarkSymbol}: ${formatPercent(activeRun.benchmarkMetrics.cumulativeReturn, { signed: true })}`
                  : "Sin benchmark seleccionado"}
              </dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Volatilidad anualizada</dt>
              <dd className={styles.kpiValue}>{formatPercent(activeRun.strategyMetrics.annualizedVolatility)}</dd>
              <dd className={styles.kpiSub}>
                {activeRun.benchmarkMetrics
                  ? `Benchmark: ${formatPercent(activeRun.benchmarkMetrics.annualizedVolatility)}`
                  : "Evaluación fuera de muestra"}
              </dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Drawdown máximo</dt>
              <dd className={`${styles.kpiValue} ${styles.negativeText}`}>
                {formatPercent(activeRun.strategyMetrics.maxDrawdown, { signed: true })}
              </dd>
              <dd className={styles.kpiSub}>
                {activeRun.benchmarkMetrics
                  ? `Benchmark: ${formatPercent(activeRun.benchmarkMetrics.maxDrawdown, { signed: true })}`
                  : "Máxima caída en evaluación"}
              </dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Ratio Sharpe</dt>
              <dd className={styles.kpiValue}>{formatRatio(activeRun.strategyMetrics.sharpeRatio)}</dd>
              <dd className={styles.kpiSub}>
                {activeRun.benchmarkMetrics
                  ? `Benchmark: ${formatRatio(activeRun.benchmarkMetrics.sharpeRatio)}`
                  : "Tasa libre de riesgo 4.50 %"}
              </dd>
            </div>
          </dl>

          <BacktestCurveChart run={activeRun} />

          <section className="panel" aria-labelledby="bt-history-title">
            <div className={styles.panelHeader}>
              <h2 id="bt-history-title">Historial de ejecuciones (RF-53)</h2>
              <span className={styles.panelMeta}>Cada corrida conserva supuestos, ventanas y métricas</span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Estrategia</th>
                    <th scope="col">Configuración</th>
                    <th scope="col">Evaluación</th>
                    <th scope="col">Benchmark</th>
                    <th scope="col" className="num">Retorno OOS</th>
                    <th scope="col" className="num">Sharpe</th>
                    <th scope="col" className="data-table__action">Ver</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.runs.map((run) => (
                    <tr key={run.id}>
                      <th scope="row">
                        {run.strategyName}
                        <span className="data-table__hint" style={{ display: "block" }}>
                          {run.rebalanceLabel} · {run.executedAt}
                        </span>
                      </th>
                      <td>
                        {run.configFrom} a {run.configTo}
                      </td>
                      <td>
                        {run.evalFrom} a {run.evalTo}
                      </td>
                      <td>{run.benchmarkSymbol ?? "Ninguno"}</td>
                      <td className="num">{formatPercent(run.strategyMetrics.cumulativeReturn, { signed: true })}</td>
                      <td className="num">{formatRatio(run.strategyMetrics.sharpeRatio)}</td>
                      <td className="data-table__action">
                        <button
                          type="button"
                          className="button button--small button--quiet"
                          onClick={() => {
                            setActiveRunId(run.id);
                            setConfigFrom(run.configFrom);
                            setConfigTo(run.configTo);
                            setEvalFrom(run.evalFrom);
                            setEvalTo(run.evalTo);
                            setBenchmark(run.benchmarkSymbol ?? "NONE");
                            setIssues([]);
                            setRunNotice(null);
                          }}
                          aria-pressed={activeRunId === run.id}
                        >
                          {activeRunId === run.id ? "Activa" : "Cargar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

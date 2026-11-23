"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { runPortfolioBacktestAction } from "@/app/app/backtesting/actions";
import { formatPercent, formatRatio } from "@/lib/formatters";
import type { AdapterResult, ValidationIssue, ViewScenario } from "@/lib/modules/runtime";
import type {
  BacktestRebalanceFrequency,
  BacktestRunRecord,
  BacktestStrategyId,
  BacktestingData,
} from "@/lib/modules/types";
import { validateBacktestWindows } from "@/lib/modules/validators";
import { ErrorSummary, LoadingSkeletonPanel, ModuleStatePanel, ProvenanceStrip } from "./ModuleStateViews";
import styles from "./modules.module.css";

function BacktestCurveChart({ run }: { run: BacktestRunRecord }) {
  const vals = run.curve.flatMap((p) =>
    [p.strategyIndex, p.benchmarkIndex].filter((v): v is number => v !== null),
  );
  if (vals.length === 0 || run.curve.length === 0) {
    return null;
  }

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
        .map((p, idx) => (p.benchmarkIndex === null ? null : { idx, val: p.benchmarkIndex }))
        .filter((item): item is { idx: number; val: number } => item !== null)
        .map((item, j) => `${j === 0 ? "M" : "L"}${toX(item.idx).toFixed(1)},${toY(item.val).toFixed(1)}`)
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
              <text
                key={idx}
                x={toX(idx)}
                y={h - 10}
                textAnchor={idx === 0 ? "start" : idx === run.curve.length - 1 ? "end" : "middle"}
                fontSize="12"
                fill="var(--muted)"
              >
                {run.curve[idx].date}
              </text>
            ))}
        </svg>
        <figcaption className={styles.chartCaption}>
          Cada etapa (configuración y evaluación fuera de muestra) reinicia su índice base en 100 antes de aplicar costos
          explícitos y frecuencia de rebalanceo.
        </figcaption>
      </figure>

      <details className={styles.chartDetails}>
        <summary>Ver puntos exactos de configuración y evaluación ({run.curve.length} sesiones)</summary>
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
              {run.curve.map((pt, idx) => (
                <tr key={`${pt.date}-${pt.phase}-${idx}`}>
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
  const isExampleMode = result.status === "ok" && result.provenance.isExample;
  const okData = result.status === "ok" ? result.data : null;

  const initialRun =
    okData && okData.activeRunId
      ? okData.runs.find((r) => r.id === okData.activeRunId) ?? okData.runs[0] ?? null
      : okData?.runs[0] ?? null;

  const [runs, setRuns] = useState<BacktestRunRecord[]>(okData?.runs ?? []);
  const [activeRunId, setActiveRunId] = useState<string | null>(initialRun?.id ?? null);
  const [strategy, setStrategy] = useState<BacktestStrategyId>(initialRun?.strategy ?? "min_variance");
  const [rebalance, setRebalance] = useState<BacktestRebalanceFrequency>(initialRun?.rebalance ?? "quarterly");
  const [transactionCostBps, setTransactionCostBps] = useState<string>(
    String(initialRun?.transactionCostBps ?? 10),
  );
  const [riskFreeRatePct, setRiskFreeRatePct] = useState<string>(
    String(((initialRun?.riskFreeRate ?? 0) * 100).toFixed(2).replace(/\.00$/, "")),
  );
  const [configFrom, setConfigFrom] = useState(initialRun?.configFrom ?? "2023-01-03");
  const [configTo, setConfigTo] = useState(initialRun?.configTo ?? "2024-12-31");
  const [evalFrom, setEvalFrom] = useState(initialRun?.evalFrom ?? "2025-01-02");
  const [evalTo, setEvalTo] = useState(initialRun?.evalTo ?? "2025-12-31");
  const [benchmarkValue, setBenchmarkValue] = useState<string>(() => {
    if (!initialRun) return isExampleMode ? "SP500" : "NONE";
    if (isExampleMode) return initialRun.benchmarkSymbol ?? "NONE";
    return initialRun.benchmarkAssetId ? String(initialRun.benchmarkAssetId) : "NONE";
  });

  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [runNotice, setRunNotice] = useState<string | null>(null);
  const [execError, setExecError] = useState<{ title: string; message: string } | null>(null);
  const [running, setRunning] = useState(false);

  if (result.status === "not_integrated") {
    return (
      <div className={styles.viewRoot}>
        <h1 className={styles.pageTitle}>Backtesting de estrategias (RF-49 a RF-53)</h1>
        <ModuleStatePanel result={result} />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRunNotice(null);
    setExecError(null);

    const validation = validateBacktestWindows({ configFrom, configTo, evalFrom, evalTo });
    const bpsNum = Number(transactionCostBps);
    const rfPctNum = Number(riskFreeRatePct);

    if (!isExampleMode) {
      if (!Number.isFinite(bpsNum) || bpsNum < 0 || bpsNum > 1000) {
        validation.push({
          field: "bt-cost-bps",
          message: "El costo de transacción debe estar entre 0 y 1000 pb.",
        });
      }
      if (!Number.isFinite(rfPctNum) || rfPctNum < -100 || rfPctNum > 100) {
        validation.push({
          field: "bt-rf-rate",
          message: "La tasa libre de riesgo anual debe estar entre -100 % y +100 %.",
        });
      }
    }

    if (validation.length > 0) {
      setIssues(validation);
      setFocusKey((k) => k + 1);
      return;
    }

    setIssues([]);
    if (isExampleMode || !okData?.portfolioId) {
      setRunNotice(
        "Ventanas válidas sin fuga temporal (la configuración termina antes del inicio fuera de muestra).",
      );
      return;
    }

    const parsedBenchmarkId = benchmarkValue === "NONE" ? null : Number(benchmarkValue);
    setRunning(true);
    try {
      const exec = await runPortfolioBacktestAction({
        portfolioId: okData.portfolioId,
        strategy,
        configFrom,
        configTo,
        evalFrom,
        evalTo,
        rebalance,
        transactionCostBps: bpsNum,
        riskFreeRate: rfPctNum / 100,
        benchmarkId: Number.isInteger(parsedBenchmarkId) && (parsedBenchmarkId ?? 0) > 0 ? parsedBenchmarkId : null,
      });

      if (!exec.ok) {
        if (exec.issues && exec.issues.length > 0) {
          setIssues(exec.issues);
          setFocusKey((k) => k + 1);
        } else {
          setExecError({ title: exec.title, message: exec.message });
        }
        return;
      }

      setRuns((prev) => [exec.run, ...prev.filter((item) => item.id !== exec.run.id)]);
      setActiveRunId(exec.run.id);
      setRunNotice(
        `Backtest guardado (${exec.run.strategyName} · v${exec.run.portfolioVersion ?? "?"}) sin modificar los pesos manuales de la cartera.`,
      );
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

  const displayedRuns = isExampleMode && okData ? okData.runs : runs;
  const activeRun =
    (activeRunId ? displayedRuns.find((r) => r.id === activeRunId) : undefined) ??
    displayedRuns[0] ??
    null;

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
      ) : result.status !== "ok" ? (
        <ModuleStatePanel result={result} onRetry={() => router.push(basePath)} />
      ) : !okData ? null : isExampleMode && !activeRun ? (
        <ModuleStatePanel
          result={{ status: "empty", title: "Sin ejecuciones", message: "No hay corridas." }}
          onRetry={() => router.push(basePath)}
        />
      ) : (
        <>
          <ProvenanceStrip provenance={result.provenance} />

          <section className={styles.panelCard} style={{ marginTop: 20 }} aria-labelledby="bt-config-title">
            <div className={styles.panelHeader}>
              <h2 id="bt-config-title">Separación de ventanas y parámetros (RF-49 y RF-50)</h2>
              <span className={styles.panelMeta}>
                {activeRun
                  ? activeRun.rebalanceLabel
                  : okData.portfolioName
                    ? `${okData.portfolioName} (${okData.portfolioCurrency ?? "USD"})`
                    : "Configuración inicial"}
              </span>
            </div>

            {!isExampleMode && okData.availablePortfolios && okData.availablePortfolios.length > 0 && (
              <div className={styles.toolbar} style={{ marginTop: 8, marginBottom: 8 }}>
                <label className="field" htmlFor="bt-portfolio">
                  <span>Cartera a evaluar</span>
                  <select
                    id="bt-portfolio"
                    value={okData.portfolioId}
                    onChange={(e) => router.push(`${basePath}?cartera=${encodeURIComponent(e.target.value)}`)}
                  >
                    {okData.availablePortfolios.map((pf) => (
                      <option key={pf.id} value={pf.id}>
                        {pf.name} ({pf.currency})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
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
                {!isExampleMode && (
                  <>
                    <label className="field" htmlFor="bt-strategy">
                      <span>Estrategia de calibración</span>
                      <select
                        id="bt-strategy"
                        value={strategy}
                        onChange={(e) => setStrategy(e.target.value as BacktestStrategyId)}
                      >
                        {okData.strategies.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field" htmlFor="bt-rebalance">
                      <span>Rebalanceo</span>
                      <select
                        id="bt-rebalance"
                        value={rebalance}
                        onChange={(e) => setRebalance(e.target.value as BacktestRebalanceFrequency)}
                      >
                        <option value="none">Sin rebalanceo</option>
                        <option value="monthly">Mensual</option>
                        <option value="quarterly">Trimestral</option>
                        <option value="semiannual">Semestral</option>
                      </select>
                    </label>

                    <label className="field" htmlFor="bt-cost-bps">
                      <span>Costo (pb)</span>
                      <input
                        id="bt-cost-bps"
                        type="number"
                        min={0}
                        max={1000}
                        step={1}
                        value={transactionCostBps}
                        onChange={(e) => setTransactionCostBps(e.target.value)}
                      />
                    </label>

                    <label className="field" htmlFor="bt-rf-rate">
                      <span>Tasa libre (%)</span>
                      <input
                        id="bt-rf-rate"
                        type="number"
                        min={-100}
                        max={100}
                        step={0.25}
                        value={riskFreeRatePct}
                        onChange={(e) => setRiskFreeRatePct(e.target.value)}
                      />
                    </label>
                  </>
                )}

                <label className="field" htmlFor="bt-benchmark">
                  <span>Benchmark opcional (RF-52)</span>
                  <select
                    id="bt-benchmark"
                    value={benchmarkValue}
                    onChange={(e) => setBenchmarkValue(e.target.value)}
                  >
                    {okData.benchmarks.map((item) => {
                      const optValue = isExampleMode
                        ? item.symbol
                        : item.id !== undefined && item.id !== null
                          ? String(item.id)
                          : item.symbol;
                      return (
                        <option key={`${optValue}-${item.symbol}`} value={optValue}>
                          {item.label}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <div className={styles.toolbarActions}>
                  <button type="submit" className="button button--small" disabled={running} aria-busy={running}>
                    {isExampleMode
                      ? "Validar separación de ventanas"
                      : running
                        ? "Ejecutando…"
                        : "Ejecutar backtest"}
                  </button>
                </div>
              </div>
            </form>

            <ErrorSummary issues={issues} focusKey={focusKey} />
            {execError && (
              <div className="notice notice--error" role="alert" style={{ marginTop: 14 }}>
                <strong>{execError.title}</strong>
                <p style={{ margin: "4px 0 0" }}>{execError.message}</p>
              </div>
            )}
            {runNotice && (
              <p className="notice" role="status">
                {runNotice}
              </p>
            )}
          </section>

          {!activeRun ? (
            <section className={styles.panelCard} style={{ marginTop: 20 }}>
              <h2 style={{ marginTop: 0 }}>Sin ejecuciones guardadas todavía</h2>
              <p style={{ color: "var(--muted)", marginBottom: 0 }}>
                Define dos ventanas históricas disjuntas (configuración estrictamente anterior a evaluación), elige la
                estrategia y presiona <strong>Ejecutar backtest</strong> para evaluar fuera de muestra.
              </p>
            </section>
          ) : (
            <>
              <dl className={styles.kpiStrip} aria-label="Métricas fuera de muestra">
                <div className={styles.kpiCell}>
                  <dt className={styles.kpiLabel}>Retorno acumulado (OOS)</dt>
                  <dd className={styles.kpiLeadValue}>
                    {formatPercent(activeRun.strategyMetrics.cumulativeReturn, { signed: true })}
                  </dd>
                  <dd className={styles.kpiSub}>
                    {activeRun.benchmarkMetrics
                      ? `Benchmark ${activeRun.benchmarkSymbol}: ${formatPercent(activeRun.benchmarkMetrics.cumulativeReturn, { signed: true })}`
                      : `Anualizado: ${formatPercent(activeRun.strategyMetrics.annualizedReturn, { signed: true })}`}
                  </dd>
                </div>
                <div className={styles.kpiCell}>
                  <dt className={styles.kpiLabel}>Volatilidad anualizada</dt>
                  <dd className={styles.kpiValue}>{formatPercent(activeRun.strategyMetrics.annualizedVolatility)}</dd>
                  <dd className={styles.kpiSub}>
                    {activeRun.benchmarkMetrics
                      ? `Benchmark: ${formatPercent(activeRun.benchmarkMetrics.annualizedVolatility)}`
                      : activeRun.evaluationWindow
                        ? `${activeRun.evaluationWindow.observations} ses. comunes`
                        : "Evaluación fuera de muestra"}
                  </dd>
                </div>
                <div className={styles.kpiCell}>
                  <dt className={styles.kpiLabel}>Drawdown máximo</dt>
                  <dd className={styles.kpiValue}>
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
                  <dd className={styles.kpiValue}>
                    {activeRun.strategyMetrics.sharpeRatio !== null
                      ? formatRatio(activeRun.strategyMetrics.sharpeRatio)
                      : "No definido"}
                  </dd>
                  <dd className={styles.kpiSub}>
                    {activeRun.benchmarkMetrics
                      ? `Benchmark: ${activeRun.benchmarkMetrics.sharpeRatio !== null ? formatRatio(activeRun.benchmarkMetrics.sharpeRatio) : "No definido"}`
                      : `Tasa libre de riesgo ${formatPercent(activeRun.riskFreeRate ?? 0)}`}
                  </dd>
                </div>
              </dl>

              <BacktestCurveChart run={activeRun} />

              {activeRun.weights && activeRun.weights.length > 0 && (
                <section className="panel" aria-labelledby="bt-weights-title">
                  <div className={styles.panelHeader}>
                    <h2 id="bt-weights-title">Pesos calibrados en configuración vs pesos manuales</h2>
                    <span className={styles.panelMeta}>
                      {activeRun.portfolioName} · v{activeRun.portfolioVersion ?? "?"} ({activeRun.currency ?? "USD"})
                    </span>
                  </div>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Activo</th>
                          <th scope="col">Mercado</th>
                          <th scope="col" className="num">Peso manual</th>
                          <th scope="col" className="num">Peso objetivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeRun.weights.map((row) => (
                          <tr key={row.assetId}>
                            <th scope="row">{row.symbol}</th>
                            <td>{row.market}</td>
                            <td className="num">{formatPercent(row.manualWeight)}</td>
                            <td className="num">{formatPercent(row.targetWeight)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

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
                      {displayedRuns.map((run) => (
                        <tr key={run.id}>
                          <th scope="row">
                            {run.strategyName}
                            {run.portfolioVersion ? ` (v${run.portfolioVersion})` : ""}
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
                          <td className="num">
                            {run.strategyMetrics.sharpeRatio !== null
                              ? formatRatio(run.strategyMetrics.sharpeRatio)
                              : "—"}
                          </td>
                          <td className="data-table__action">
                            <button
                              type="button"
                              className="button button--small button--quiet"
                              onClick={() => {
                                setActiveRunId(run.id);
                                if (run.strategy) setStrategy(run.strategy);
                                if (run.rebalance) setRebalance(run.rebalance);
                                setTransactionCostBps(String(run.transactionCostBps));
                                if (typeof run.riskFreeRate === "number") {
                                  setRiskFreeRatePct(
                                    String((run.riskFreeRate * 100).toFixed(2).replace(/\.00$/, "")),
                                  );
                                }
                                setConfigFrom(run.configFrom);
                                setConfigTo(run.configTo);
                                setEvalFrom(run.evalFrom);
                                setEvalTo(run.evalTo);
                                setBenchmarkValue(
                                  isExampleMode
                                    ? run.benchmarkSymbol ?? "NONE"
                                    : run.benchmarkAssetId
                                      ? String(run.benchmarkAssetId)
                                      : "NONE",
                                );
                                setIssues([]);
                                setExecError(null);
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
        </>
      )}
    </div>
  );
}

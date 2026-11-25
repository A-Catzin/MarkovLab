"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { runPortfolioOptimizationAction } from "@/app/app/optimizacion/actions";
import { formatDateIso, formatInteger, formatPercent, formatRatio } from "@/lib/formatters";
import type { AdapterResult, ProvenanceInfo, ValidationIssue, ViewScenario } from "@/lib/modules/runtime";
import type {
  OptimizationData,
  OptimizationObjective,
  OptimizationRunRecord,
  OptimizationWeightRow,
} from "@/lib/modules/types";
import { validateOptimizationConstraints } from "@/lib/modules/validators";
import { ErrorSummary, LoadingSkeletonPanel, ModuleStatePanel, ProvenanceStrip } from "./ModuleStateViews";
import styles from "./modules.module.css";

interface InfeasibleFeedback {
  title: string;
  message: string;
  conflicts: string[];
  minimumVolatility: number | null;
}

function WeightsComparisonChart({ rows }: { rows: OptimizationWeightRow[] }) {
  const w = 680;
  const rowH = 38;
  const padL = 96;
  const padR = 24;
  const padT = 18;
  const padB = 30;
  const h = padT + rows.length * rowH + padB;
  const innerW = w - padL - padR;
  const maxPct = Math.max(0.5, ...rows.flatMap((r) => [r.manualWeight, r.optimizedWeight]));
  const ticks = [0, 0.25, 0.5, 0.75, 1.0].filter((v) => v <= maxPct + 0.01);

  return (
    <section className={styles.panelCard} aria-labelledby="opt-chart-title">
      <div className={styles.panelHeader}>
        <h2 id="opt-chart-title">Pesos manuales vs solución optimizada</h2>
        <span className={styles.panelMeta}>Escala en porcentaje del capital</span>
      </div>
      <div className={styles.chartLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#6ea8fe" }} aria-hidden="true" /> Cartera manual
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#e2b04a" }} aria-hidden="true" /> Pesos optimizados
        </span>
      </div>
      <figure className={styles.chartFrame}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className={styles.chartSvg}
          role="img"
          aria-label="Comparación de pesos manuales frente a pesos optimizados"
        >
          {ticks.map((tick) => {
            const x = padL + (tick / maxPct) * innerW;
            return (
              <g key={tick}>
                <line x1={x} x2={x} y1={padT} y2={h - padB} stroke="var(--surface-2)" strokeWidth={1} />
                <text x={x} y={h - 10} textAnchor="middle" fontSize="12" fill="var(--muted)">
                  {Math.round(tick * 100)} %
                </text>
              </g>
            );
          })}
          {rows.map((row, idx) => {
            const top = padT + idx * rowH + 6;
            const manualW = (row.manualWeight / maxPct) * innerW;
            const optW = (row.optimizedWeight / maxPct) * innerW;
            return (
              <g key={row.symbol}>
                <text x={padL - 10} y={top + 14} textAnchor="end" fontSize="12" fontWeight={600} fill="var(--ink)">
                  {row.symbol}
                </text>
                <rect x={padL} y={top} width={manualW} height={9} fill="#6ea8fe" rx={2} />
                <rect x={padL} y={top + 12} width={optW} height={9} fill="#e2b04a" rx={2} />
              </g>
            );
          })}
        </svg>
      </figure>
    </section>
  );
}

function buildBoundRows(weights: OptimizationWeightRow[]) {
  return weights.map((w) => ({
    assetId: w.assetId,
    symbol: w.symbol,
    manualWeight: w.manualWeight,
    minPct: String((w.minWeight * 100).toFixed(0)),
    maxPct: String((w.maxWeight * 100).toFixed(0)),
  }));
}

export function OptimizationView({
  result,
  basePath,
  currentScenario,
  initialObjective,
}: {
  result: AdapterResult<OptimizationData>;
  basePath: string;
  currentScenario: ViewScenario;
  initialObjective: OptimizationObjective;
}) {
  const router = useRouter();
  const isExampleMode = result.status === "ok" && result.provenance.isExample;

  const [history, setHistory] = useState<OptimizationRunRecord[]>(() =>
    result.status === "ok" ? (result.data.history ?? []) : [],
  );
  const [displayedRun, setDisplayedRun] = useState<OptimizationRunRecord | null>(() =>
    result.status === "ok" ? (result.data.activeRun ?? null) : null,
  );
  const [objective, setObjective] = useState<OptimizationObjective>(initialObjective);
  const [bounds, setBounds] = useState(() =>
    result.status === "ok" ? buildBoundRows(result.data.weights) : [],
  );
  const [maxVolPct, setMaxVolPct] = useState(
    result.status === "ok" && result.data.maxVolatilityCap !== null
      ? String((result.data.maxVolatilityCap * 100).toFixed(2).replace(/\.00$/, ""))
      : "",
  );
  const [riskFreeRatePct, setRiskFreeRatePct] = useState(
    result.status === "ok" ? String((result.data.riskFreeRate * 100).toFixed(2).replace(/\.00$/, "")) : "0",
  );
  const [lookbackYears, setLookbackYears] = useState(
    result.status === "ok" ? String(result.data.lookbackYears ?? 5) : "5",
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [infeasibleFeedback, setInfeasibleFeedback] = useState<InfeasibleFeedback | null>(null);
  const [apiAlert, setApiAlert] = useState<Exclude<AdapterResult<OptimizationData>, { status: "ok" }> | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [clientNotice, setClientNotice] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  if (result.status === "not_integrated") {
    return (
      <div className={styles.viewRoot}>
        <h1 className={styles.pageTitle}>Optimización de carteras</h1>
        <ModuleStatePanel result={result} />
      </div>
    );
  }

  function switchObjective(nextObjective: OptimizationObjective) {
    setObjective(nextObjective);
    if (isExampleMode) {
      const q = new URLSearchParams();
      if (currentScenario !== "normal") q.set("escenario", currentScenario);
      q.set("objetivo", nextObjective);
      router.push(`${basePath}?${q.toString()}`);
    }
  }

  function switchPortfolio(portfolioId: string) {
    router.push(`${basePath}?cartera=${encodeURIComponent(portfolioId)}`);
  }

  function inspectRun(run: OptimizationRunRecord) {
    setDisplayedRun(run);
    setObjective(run.objective);
    setBounds(buildBoundRows(run.weights));
    setMaxVolPct(
      run.maxVolatilityCap !== null ? String((run.maxVolatilityCap * 100).toFixed(2).replace(/\.00$/, "")) : "",
    );
    setRiskFreeRatePct(String((run.riskFreeRate * 100).toFixed(2).replace(/\.00$/, "")));
    setLookbackYears(String(run.lookbackYears));
    setIssues([]);
    setInfeasibleFeedback(null);
    setApiAlert(null);
    setClientNotice(
      `Inspeccionando ejecución del ${formatDateIso(run.createdAt.slice(0, 10))} (v${run.portfolioVersion} · ${run.objective === "min_variance" ? "Mínima varianza" : "Máximo Sharpe"}).`,
    );
  }

  function applyMinimumVolatility() {
    if (infeasibleFeedback?.minimumVolatility == null) return;
    const ceilingPct = (Math.ceil(infeasibleFeedback.minimumVolatility * 10000) / 100).toFixed(2);
    setMaxVolPct(ceilingPct);
    setInfeasibleFeedback(null);
    setClientNotice(
      `Se cargó ${ceilingPct} % en el tope de volatilidad (mínimo alcanzable reportado por la API). Presiona "Calcular y guardar optimización" para volver a resolver.`,
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (result.status !== "ok") return;

    if (isExampleMode) {
      const cap = maxVolPct.trim() === "" ? null : Number(maxVolPct) / 100;
      const check = validateOptimizationConstraints(
        bounds.map((b) => ({
          symbol: b.symbol,
          minWeight: Number(b.minPct) / 100,
          maxWeight: Number(b.maxPct) / 100,
        })),
        cap,
        result.data.feasibleMinVolatility ?? 0.114,
      );

      if (check.issues.length > 0) {
        setIssues(check.issues);
        setInfeasibleFeedback(null);
        setClientNotice(null);
        setFocusKey((k) => k + 1);
        return;
      }
      if (check.infeasibleReasons.length > 0) {
        setIssues([]);
        setInfeasibleFeedback({
          title: "Combinación de restricciones inviable",
          message: "No existe ninguna cartera que satisfaga simultáneamente estos límites y sume 100 %.",
          conflicts: check.infeasibleReasons,
          minimumVolatility: result.data.feasibleMinVolatility,
        });
        setClientNotice(null);
        return;
      }
      setIssues([]);
      setInfeasibleFeedback(null);
      setClientNotice(
        "Restricciones válidas y factibles en modo de demostración (MARKOVLAB_USE_LOCAL_FIXTURES=1).",
      );
      return;
    }

    if (!result.data.portfolioId) return;

    const formIssues: ValidationIssue[] = [];
    const cap = maxVolPct.trim() === "" ? null : Number(maxVolPct.replace(",", ".")) / 100;
    const rfRate = Number(riskFreeRatePct.replace(",", ".")) / 100;
    const lookback = Number(lookbackYears);

    if (maxVolPct.trim() !== "" && (!Number.isFinite(cap) || (cap as number) < 0)) {
      formIssues.push({
        field: "opt-max-vol",
        message: "El tope opcional de volatilidad anual debe ser un número mayor o igual a 0 %.",
      });
    }
    if (!Number.isFinite(rfRate) || rfRate < -1 || rfRate > 1) {
      formIssues.push({
        field: "opt-rf-rate",
        message: "La tasa libre de riesgo anual debe estar entre -100 % y +100 %.",
      });
    }
    if (!Number.isInteger(lookback) || lookback < 1 || lookback > 20) {
      formIssues.push({
        field: "opt-lookback",
        message: "La ventana histórica debe ser un entero entre 1 y 20 años.",
      });
    }

    const parsedBounds = bounds.map((b) => ({
      assetId: b.assetId,
      symbol: b.symbol,
      minWeight: Number(b.minPct.replace(",", ".")) / 100,
      maxWeight: Number(b.maxPct.replace(",", ".")) / 100,
    }));

    for (const row of parsedBounds) {
      if (!Number.isFinite(row.minWeight) || !Number.isFinite(row.maxWeight)) {
        formIssues.push({
          field: `opt-min-${row.symbol}`,
          message: `Revisa los límites numéricos de ${row.symbol}.`,
        });
        break;
      }
      if (row.minWeight < 0 || row.maxWeight > 1) {
        formIssues.push({
          field: `opt-min-${row.symbol}`,
          message: `Los límites de ${row.symbol} deben estar entre 0 % y 100 %.`,
        });
        break;
      }
      if (row.minWeight > row.maxWeight) {
        formIssues.push({
          field: `opt-min-${row.symbol}`,
          message: `En ${row.symbol}, el mínimo supera al máximo.`,
        });
        break;
      }
    }

    if (formIssues.length > 0) {
      setIssues(formIssues);
      setInfeasibleFeedback(null);
      setApiAlert(null);
      setClientNotice(null);
      setFocusKey((k) => k + 1);
      return;
    }

    setIssues([]);
    setInfeasibleFeedback(null);
    setApiAlert(null);
    setClientNotice(null);
    setRunning(true);

    const exec = await runPortfolioOptimizationAction({
      portfolioId: result.data.portfolioId,
      objective,
      bounds: parsedBounds.map(({ assetId, minWeight, maxWeight }) => ({
        assetId,
        minWeight,
        maxWeight,
      })),
      lookbackYears: lookback,
      riskFreeRate: rfRate,
      maxVolatility: cap,
    });
    setRunning(false);

    if (exec.ok) {
      setDisplayedRun(exec.run);
      setHistory((prev) => [exec.run, ...prev.filter((item) => item.id !== exec.run.id)]);
      setClientNotice(
        `Optimización guardada en el historial (v${exec.run.portfolioVersion} · ${exec.run.solver}). Los pesos de tu cartera no fueron modificados.`,
      );
      router.refresh();
      return;
    }

    if (exec.kind === "infeasible") {
      setInfeasibleFeedback({
        title: exec.title,
        message: exec.message,
        conflicts: exec.conflicts ?? [],
        minimumVolatility: exec.minimumVolatility ?? null,
      });
      return;
    }

    if (exec.kind === "validation") {
      setIssues(exec.issues ?? [{ field: "opt-config-title", message: exec.message }]);
      setFocusKey((k) => k + 1);
      return;
    }

    if (exec.kind === "insufficient_data") {
      setApiAlert({
        status: "insufficient_data",
        title: exec.title,
        message: exec.message,
        details: ["Se requieren al menos 60 cierres comunes sin rellenar entre todos los activos de la cartera."],
      });
      return;
    }

    if (exec.kind === "undefined_sharpe") {
      setApiAlert({
        status: "infeasible",
        title: exec.title,
        message: exec.message,
        conflicts: [
          "El activo o rango factible tiene volatilidad nula o por debajo del umbral numérico requerido para dividir el exceso de retorno.",
          "Prueba ejecutar mínima varianza o ampliar las cotas por activo.",
        ],
      });
      return;
    }

    if (exec.kind === "forbidden") {
      setApiAlert({ status: "forbidden", title: exec.title, message: exec.message });
      return;
    }

    if (exec.kind === "not_found") {
      setApiAlert({
        status: "empty",
        title: exec.title,
        message: exec.message,
        actionLabel: "Volver a Mis carteras",
        actionHref: "/app/carteras",
      });
      return;
    }

    setApiAlert({ status: "unavailable", title: exec.title, message: exec.message });
  }

  function resetBounds() {
    if (result.status !== "ok") return;
    const baseWeights = displayedRun?.weights ?? result.data.weights;
    setBounds(
      baseWeights.map((w) => ({
        assetId: w.assetId,
        symbol: w.symbol,
        manualWeight: w.manualWeight,
        minPct: "0",
        maxPct: "100",
      })),
    );
    setMaxVolPct("");
    setIssues([]);
    setInfeasibleFeedback(null);
    setApiAlert(null);
    setClientNotice(null);
  }

  const activeWeights =
    result.status === "ok" ? (displayedRun ? displayedRun.weights : result.data.weights) : [];
  const activeManualStats =
    result.status === "ok" ? (displayedRun ? displayedRun.manualStats : result.data.manualStats) : null;
  const activeOptimizedStats =
    result.status === "ok" ? (displayedRun ? displayedRun.optimizedStats : result.data.optimizedStats) : null;
  const activeFeasibleMin =
    result.status === "ok"
      ? (displayedRun ? displayedRun.feasibleMinVolatility : result.data.feasibleMinVolatility)
      : null;

  const activeProvenance: ProvenanceInfo | null =
    result.status !== "ok"
      ? null
      : displayedRun && !isExampleMode
        ? {
            origin: "api",
            freshness: "fresh",
            isExample: false,
            calculatedAt: displayedRun.createdAt.slice(0, 10),
            effectiveRange: {
              from: displayedRun.window.from,
              to: displayedRun.window.to,
              observations: displayedRun.observations,
            },
            assumptions: `Versión v${displayedRun.portfolioVersion} · ${displayedRun.solver} ${displayedRun.solverWrapperVersion} · tasa libre ${(displayedRun.riskFreeRate * 100).toFixed(2)} % · no modifica los pesos de la cartera ni constituye recomendación financiera`,
          }
        : result.provenance;

  return (
    <div className={styles.viewRoot}>
      <div className={styles.pageHeadMeta}>
        <div>
          <h1 className={styles.pageTitle}>Optimización de carteras</h1>
          <p className={styles.pageLead}>
            Calcula asignaciones de mínima varianza o máximo Sharpe sujetas a límites mínimo y máximo por activo y tope
            opcional de volatilidad. Ninguna optimización modifica tu cartera ni constituye una recomendación de
            inversión.
          </p>
        </div>
      </div>

      <section className={styles.panelCard} style={{ marginTop: 16 }} aria-labelledby="opt-config-title">
        <div className={styles.panelHeader}>
          <div>
            <h2 id="opt-config-title">
              {result.status === "ok" ? `Objetivo y restricciones · ${result.data.portfolioName}` : "Objetivo y restricciones"}
            </h2>
          </div>
          {result.status === "ok" && (
            <span className={styles.panelMeta}>
              {displayedRun
                ? `Rendimientos diarios anualizados (${displayedRun.periodsPerYear} días/año · ${displayedRun.solver})`
                : result.data.frequencyLabel}
              {activeFeasibleMin !== null ? ` · volatilidad mínima alcanzable ${formatPercent(activeFeasibleMin)}` : ""}
            </span>
          )}
        </div>

        {result.status === "ok" && result.data.availablePortfolios && result.data.availablePortfolios.length > 0 && (
          <div className={styles.toolbar} style={{ marginBottom: 14 }}>
            <label className="field" htmlFor="opt-portfolio-select">
              <span>Cartera base</span>
              <select
                id="opt-portfolio-select"
                value={result.data.portfolioId}
                onChange={(e) => switchPortfolio(e.target.value)}
              >
                {result.data.availablePortfolios.map((pf) => (
                  <option key={pf.id} value={pf.id}>
                    {pf.name} ({pf.currency})
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className={styles.toolbar}>
          <div>
            <span className={styles.panelMeta} style={{ display: "block", marginBottom: 6 }}>
              Objetivo matemático
            </span>
            <div className={styles.chipGroup} role="group" aria-label="Objetivo de optimización">
              <button
                type="button"
                className={`${styles.chipButton} ${objective === "min_variance" ? styles.chipButtonActive : ""}`}
                aria-pressed={objective === "min_variance"}
                onClick={() => switchObjective("min_variance")}
              >
                Mínima varianza
              </button>
              <button
                type="button"
                className={`${styles.chipButton} ${objective === "max_sharpe" ? styles.chipButtonActive : ""}`}
                aria-pressed={objective === "max_sharpe"}
                onClick={() => switchObjective("max_sharpe")}
              >
                Máximo ratio Sharpe
              </button>
            </div>
          </div>

          <label className="field" htmlFor="opt-max-vol">
            <span>Tope opcional de volatilidad anual (%)</span>
            <input
              id="opt-max-vol"
              inputMode="decimal"
              placeholder="Sin tope (ej. 16)"
              value={maxVolPct}
              onChange={(e) => setMaxVolPct(e.target.value)}
            />
          </label>

          {!isExampleMode && (
            <>
              <label className="field" htmlFor="opt-rf-rate">
                <span>Tasa libre de riesgo anual (%)</span>
                <input
                  id="opt-rf-rate"
                  inputMode="decimal"
                  value={riskFreeRatePct}
                  onChange={(e) => setRiskFreeRatePct(e.target.value)}
                />
              </label>

              <label className="field" htmlFor="opt-lookback">
                <span>Ventana histórica (años)</span>
                <input
                  id="opt-lookback"
                  inputMode="numeric"
                  value={lookbackYears}
                  onChange={(e) => setLookbackYears(e.target.value)}
                />
              </label>
            </>
          )}
        </div>

        {result.status === "ok" && bounds.length > 0 && (
          <form onSubmit={handleSubmit} style={{ marginTop: 16 }} noValidate>
            <div id="opt-bounds-table" className="table-wrap" style={{ marginTop: 8 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Activo</th>
                    <th scope="col" className="num">Peso manual</th>
                    <th scope="col">Mínimo (%)</th>
                    <th scope="col">Máximo (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {bounds.map((row, idx) => (
                    <tr key={row.symbol}>
                      <th scope="row">{row.symbol}</th>
                      <td className="num">{formatPercent(row.manualWeight)}</td>
                      <td>
                        <label className="field" htmlFor={`opt-min-${row.symbol}`}>
                          <span className="sr-only">Mínimo {row.symbol}</span>
                          <input
                            id={`opt-min-${row.symbol}`}
                            inputMode="decimal"
                            value={row.minPct}
                            onChange={(e) =>
                              setBounds((curr) =>
                                curr.map((item, i) => (i === idx ? { ...item, minPct: e.target.value } : item)),
                              )
                            }
                          />
                        </label>
                      </td>
                      <td>
                        <label className="field" htmlFor={`opt-max-${row.symbol}`}>
                          <span className="sr-only">Máximo {row.symbol}</span>
                          <input
                            id={`opt-max-${row.symbol}`}
                            inputMode="decimal"
                            value={row.maxPct}
                            onChange={(e) =>
                              setBounds((curr) =>
                                curr.map((item, i) => (i === idx ? { ...item, maxPct: e.target.value } : item)),
                              )
                            }
                          />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ErrorSummary issues={issues} focusKey={focusKey} />
            {clientNotice && (
              <p className="notice" role="status" style={{ marginTop: 12 }}>
                {clientNotice}
              </p>
            )}

            <div className={styles.actionRow} style={{ marginTop: 14 }}>
              <button type="submit" className="button button--small" disabled={running} aria-busy={running}>
                {running
                  ? "Optimizando en HiGHS…"
                  : isExampleMode
                    ? "Comprobar restricciones"
                    : "Calcular y guardar optimización"}
              </button>
              <button type="button" className="button button--small button--quiet" onClick={resetBounds} disabled={running}>
                Restablecer límites
              </button>
            </div>
          </form>
        )}
      </section>

      {currentScenario === "cargando" ? (
        <div style={{ marginTop: 20 }}>
          <LoadingSkeletonPanel title="Comparación Manual vs Optimizada" />
        </div>
      ) : infeasibleFeedback ? (
        <>
          <ModuleStatePanel
            result={{
              status: "infeasible",
              title: infeasibleFeedback.title,
              message: infeasibleFeedback.message,
              conflicts: infeasibleFeedback.conflicts,
            }}
            onRetry={resetBounds}
          />
          {infeasibleFeedback.minimumVolatility !== null && (
            <div className={styles.actionRow} style={{ marginTop: 12 }}>
              <button type="button" className="button button--small" onClick={applyMinimumVolatility}>
                Usar mínimo alcanzable ({(infeasibleFeedback.minimumVolatility * 100).toFixed(2)} %)
              </button>
            </div>
          )}
        </>
      ) : apiAlert ? (
        <ModuleStatePanel result={apiAlert} onRetry={() => setApiAlert(null)} />
      ) : result.status !== "ok" ? (
        <ModuleStatePanel result={result} onRetry={() => router.push(basePath)} />
      ) : (
        <>
          {activeProvenance && <ProvenanceStrip provenance={activeProvenance} />}

          {activeOptimizedStats === null || activeManualStats === null ? (
            <section className="panel" role="status" style={{ marginTop: 16 }}>
              <h2>Todavía no hay optimizaciones guardadas para esta cartera</h2>
              <p className="panel__help">
                Ajusta el objetivo (mínima varianza o máximo Sharpe), las cotas por activo o el tope opcional de
                volatilidad y presiona <strong>Calcular y guardar optimización</strong> para obtener la primera
                comparación frente a tus pesos manuales.
              </p>
            </section>
          ) : (
            <>
              <dl className={styles.kpiStrip} aria-label="Comparación Manual versus Optimizada">
                <div className={styles.kpiCell}>
                  <dt className={styles.kpiLabel}>Volatilidad anual optimizada</dt>
                  <dd className={styles.kpiLeadValue}>{formatPercent(activeOptimizedStats.annualizedVolatility)}</dd>
                  <dd className={styles.kpiSub}>
                    Manual: {formatPercent(activeManualStats.annualizedVolatility)}
                    {activeFeasibleMin !== null ? ` · mín. ${formatPercent(activeFeasibleMin)}` : ""}
                  </dd>
                </div>
                <div className={styles.kpiCell}>
                  <dt className={styles.kpiLabel}>Retorno esperado optimizado</dt>
                  <dd className={styles.kpiValue}>{formatPercent(activeOptimizedStats.expectedAnnualReturn, { signed: true })}</dd>
                  <dd className={styles.kpiSub}>
                    Manual: {formatPercent(activeManualStats.expectedAnnualReturn, { signed: true })}
                  </dd>
                </div>
                <div className={styles.kpiCell}>
                  <dt className={styles.kpiLabel}>Ratio Sharpe estimado</dt>
                  <dd className={styles.kpiValue}>{formatRatio(activeOptimizedStats.sharpeRatio)}</dd>
                  <dd className={styles.kpiSub}>Manual: {formatRatio(activeManualStats.sharpeRatio)}</dd>
                </div>
                <div className={styles.kpiCell}>
                  <dt className={styles.kpiLabel}>Carácter académico</dt>
                  <dd className={styles.kpiValue}>No asesoría</dd>
                  <dd className={styles.kpiSub}>
                    {displayedRun
                      ? `Ejecución v${displayedRun.portfolioVersion} · ${displayedRun.solver}`
                      : "Supuestos históricos · modelo no garantiza rendimiento"}
                  </dd>
                </div>
              </dl>

              <div className={styles.splitGrid}>
                <WeightsComparisonChart rows={activeWeights} />

                <section className={styles.panelCard} aria-labelledby="opt-table-title">
                  <div className={styles.panelHeader}>
                    <h2 id="opt-table-title">Comparación por activo</h2>
                    <span className={styles.panelMeta}>Suma total 100.00 %</span>
                  </div>
                  <div className="table-wrap" style={{ marginTop: 8 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Activo</th>
                          <th scope="col" className="num">Manual</th>
                          <th scope="col" className="num">Optimizada</th>
                          <th scope="col" className="num">Cambio</th>
                          <th scope="col" className="num">Cotas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeWeights.map((row) => {
                          const diff = row.optimizedWeight - row.manualWeight;
                          return (
                            <tr key={row.assetId}>
                              <th scope="row">{row.symbol}</th>
                              <td className="num">{formatPercent(row.manualWeight)}</td>
                              <td className="num">{formatPercent(row.optimizedWeight)}</td>
                              <td className="num">{formatPercent(diff, { signed: true })}</td>
                              <td className="num">
                                {formatPercent(row.minWeight, { decimals: 0 })} – {formatPercent(row.maxWeight, { decimals: 0 })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          )}

          {history.length > 0 && (
            <section className="panel" style={{ marginTop: 20 }} aria-labelledby="opt-history-title">
              <div className={styles.panelHeader}>
                <div>
                  <h2 id="opt-history-title">Historial de optimizaciones guardadas</h2>
                  <p className="panel__help">
                    Cada ejecución conserva la versión de la cartera, sus insumos históricos y las cotas aplicadas.
                  </p>
                </div>
                <span className={styles.panelMeta}>{formatInteger(history.length)} ejecuciones</span>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Fecha / versión</th>
                      <th scope="col">Objetivo</th>
                      <th scope="col" className="num">Tope vol.</th>
                      <th scope="col" className="num">Vol. opt.</th>
                      <th scope="col" className="num">Retorno opt.</th>
                      <th scope="col" className="num">Sharpe opt.</th>
                      <th scope="col">Ventana</th>
                      <th scope="col" className="data-table__action">Vista</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((run) => {
                      const isActive = displayedRun?.id === run.id;
                      return (
                        <tr key={run.id}>
                          <th scope="row">
                            {formatDateIso(run.createdAt.slice(0, 10))}
                            <span className="data-table__hint" style={{ display: "block" }}>
                              v{run.portfolioVersion} · {run.solver}
                            </span>
                          </th>
                          <td>{run.objective === "min_variance" ? "Mínima varianza" : "Máximo Sharpe"}</td>
                          <td className="num">
                            {run.maxVolatilityCap === null ? "Sin tope" : formatPercent(run.maxVolatilityCap)}
                          </td>
                          <td className="num">{formatPercent(run.optimizedStats.annualizedVolatility)}</td>
                          <td className="num">
                            {formatPercent(run.optimizedStats.expectedAnnualReturn, { signed: true })}
                          </td>
                          <td className="num">{formatRatio(run.optimizedStats.sharpeRatio)}</td>
                          <td>
                            {run.window.from} a {run.window.to}
                            <span className="data-table__hint" style={{ display: "block" }}>
                              {formatInteger(run.observations)} sesiones
                            </span>
                          </td>
                          <td className="data-table__action">
                            {isActive ? (
                              <span className={`${styles.pill} ${styles.pillFresh}`}>Activa</span>
                            ) : (
                              <button
                                type="button"
                                className="button button--small button--quiet"
                                onClick={() => inspectRun(run)}
                              >
                                Inspeccionar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
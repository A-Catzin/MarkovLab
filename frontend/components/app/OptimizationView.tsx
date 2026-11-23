"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPercent, formatRatio } from "@/lib/formatters";
import type { AdapterResult, ValidationIssue, ViewScenario } from "@/lib/modules/runtime";
import type { OptimizationData, OptimizationObjective, OptimizationWeightRow } from "@/lib/modules/types";
import { validateOptimizationConstraints } from "@/lib/modules/validators";
import { ErrorSummary, LoadingSkeletonPanel, ModuleStatePanel, ProvenanceStrip } from "./ModuleStateViews";
import styles from "./modules.module.css";

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
        <svg viewBox={`0 0 ${w} ${h}`} className={styles.chartSvg} role="img" aria-label="Comparación de pesos manuales frente a pesos optimizados">
          {[0, 0.25, 0.5].filter((v) => v <= maxPct + 0.01).map((tick) => {
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
  const [objective, setObjective] = useState<OptimizationObjective>(initialObjective);
  const [bounds, setBounds] = useState(() =>
    result.status === "ok"
      ? result.data.weights.map((w) => ({
          symbol: w.symbol,
          minPct: String((w.minWeight * 100).toFixed(0)),
          maxPct: String((w.maxWeight * 100).toFixed(0)),
        }))
      : [],
  );
  const [maxVolPct, setMaxVolPct] = useState(
    result.status === "ok" && result.data.maxVolatilityCap !== null
      ? String((result.data.maxVolatilityCap * 100).toFixed(1))
      : "",
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [infeasibleConflicts, setInfeasibleConflicts] = useState<string[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [clientNotice, setClientNotice] = useState<string | null>(null);

  if (result.status === "not_integrated") {
    return (
      <div className={styles.viewRoot}>
        <h1 className={styles.pageTitle}>Optimización de carteras (RF-34 a RF-40)</h1>
        <ModuleStatePanel result={result} />
      </div>
    );
  }

  function switchObjective(nextObjective: OptimizationObjective) {
    setObjective(nextObjective);
    const q = new URLSearchParams();
    if (currentScenario !== "normal") q.set("escenario", currentScenario);
    q.set("objetivo", nextObjective);
    router.push(`${basePath}?${q.toString()}`);
  }

  function handleValidateBounds(e: React.FormEvent) {
    e.preventDefault();
    if (result.status !== "ok") return;
    const cap = maxVolPct.trim() === "" ? null : Number(maxVolPct) / 100;
    const check = validateOptimizationConstraints(
      bounds.map((b) => ({
        symbol: b.symbol,
        minWeight: Number(b.minPct) / 100,
        maxWeight: Number(b.maxPct) / 100,
      })),
      cap,
      result.data.feasibleMinVolatility,
    );

    if (check.issues.length > 0) {
      setIssues(check.issues);
      setInfeasibleConflicts([]);
      setClientNotice(null);
      setFocusKey((k) => k + 1);
      return;
    }
    if (check.infeasibleReasons.length > 0) {
      setIssues([]);
      setInfeasibleConflicts(check.infeasibleReasons);
      setClientNotice(null);
      return;
    }
    setIssues([]);
    setInfeasibleConflicts([]);
    setClientNotice(
      "Restricciones válidas y factibles. El recálculo numérico para cotas editadas a medida requiere conectar B5 en Julia (el solver no se duplica en TypeScript).",
    );
  }

  function resetBounds() {
    if (result.status !== "ok") return;
    setBounds(
      result.data.weights.map((w) => ({
        symbol: w.symbol,
        minPct: String((w.minWeight * 100).toFixed(0)),
        maxPct: String((w.maxWeight * 100).toFixed(0)),
      })),
    );
    setMaxVolPct("");
    setIssues([]);
    setInfeasibleConflicts([]);
    setClientNotice(null);
  }

  return (
    <div className={styles.viewRoot}>
      <div className={styles.pageHeadMeta}>
        <div>
          <h1 className={styles.pageTitle}>Optimización de carteras (RF-34 a RF-40)</h1>
          <p className={styles.pageLead}>
            Calcula asignaciones de mínima varianza o máximo Sharpe sujetas a límites mínimo y máximo por activo y tope
            opcional de volatilidad. Los resultados son exploratorios sobre datos históricos y no constituyen una
            recomendación de inversión.
          </p>
        </div>
      </div>

      <section className={styles.panelCard} style={{ marginTop: 16 }} aria-labelledby="opt-config-title">
        <div className={styles.panelHeader}>
          <h2 id="opt-config-title">Objetivo y restricciones</h2>
          {result.status === "ok" && (
            <span className={styles.panelMeta}>
              {result.data.frequencyLabel} · tasa libre de riesgo {formatPercent(result.data.riskFreeRate)}
            </span>
          )}
        </div>

        <div className={styles.toolbar}>
          <div>
            <span className={styles.panelMeta} style={{ display: "block", marginBottom: 6 }}>
              Objetivo matemático (RF-35)
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
        </div>

        {result.status === "ok" && bounds.length > 0 && (
          <form onSubmit={handleValidateBounds} style={{ marginTop: 16 }} noValidate>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Activo</th>
                    <th scope="col">Mínimo (%)</th>
                    <th scope="col">Máximo (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {bounds.map((row, idx) => (
                    <tr key={row.symbol}>
                      <th scope="row">{row.symbol}</th>
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
              <p className="notice" role="status">
                {clientNotice}
              </p>
            )}

            <div className={styles.actionRow} style={{ marginTop: 14 }}>
              <button type="submit" className="button button--small">
                Comprobar restricciones
              </button>
              <button type="button" className="button button--small button--quiet" onClick={resetBounds}>
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
      ) : infeasibleConflicts.length > 0 ? (
        <ModuleStatePanel
          result={{
            status: "infeasible",
            title: "Combinación de restricciones inviable (RF-39)",
            message: "No existe ninguna cartera que satisfaga simultáneamente estos límites y sume 100 %.",
            conflicts: infeasibleConflicts,
          }}
          onRetry={resetBounds}
        />
      ) : result.status !== "ok" ? (
        <ModuleStatePanel result={result} onRetry={() => router.push(basePath)} />
      ) : (
        <>
          <ProvenanceStrip provenance={result.provenance} />

          <dl className={styles.kpiStrip} aria-label="Comparación Manual versus Optimizada">
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Volatilidad anual optimizada</dt>
              <dd className={styles.kpiLeadValue}>{formatPercent(result.data.optimizedStats.annualizedVolatility)}</dd>
              <dd className={styles.kpiSub}>
                Manual: {formatPercent(result.data.manualStats.annualizedVolatility)}
              </dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Retorno esperado optimizado</dt>
              <dd className={styles.kpiValue}>{formatPercent(result.data.optimizedStats.expectedAnnualReturn, { signed: true })}</dd>
              <dd className={styles.kpiSub}>
                Manual: {formatPercent(result.data.manualStats.expectedAnnualReturn, { signed: true })}
              </dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Ratio Sharpe estimado</dt>
              <dd className={styles.kpiValue}>{formatRatio(result.data.optimizedStats.sharpeRatio)}</dd>
              <dd className={styles.kpiSub}>Manual: {formatRatio(result.data.manualStats.sharpeRatio)}</dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Carácter académico</dt>
              <dd className={styles.kpiValue}>No asesoría</dd>
              <dd className={styles.kpiSub}>Supuestos históricos · modelo no garantiza rendimiento</dd>
            </div>
          </dl>

          <div className={styles.splitGrid}>
            <WeightsComparisonChart rows={result.data.weights} />

            <section className={styles.panelCard} aria-labelledby="opt-table-title">
              <div className={styles.panelHeader}>
                <h2 id="opt-table-title">Comparación por activo (RF-40)</h2>
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
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.weights.map((row) => {
                      const diff = row.optimizedWeight - row.manualWeight;
                      return (
                        <tr key={row.assetId}>
                          <th scope="row">{row.symbol}</th>
                          <td className="num">{formatPercent(row.manualWeight)}</td>
                          <td className="num">{formatPercent(row.optimizedWeight)}</td>
                          <td className="num">{formatPercent(diff, { signed: true })}</td>
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
    </div>
  );
}

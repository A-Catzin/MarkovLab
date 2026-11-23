"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatInteger, formatPercent, formatRatio } from "@/lib/formatters";
import type { AdapterResult, ViewScenario } from "@/lib/modules/runtime";
import type { AssetAnalysisData, PeriodPreset, ReturnKind } from "@/lib/modules/types";
import { validateDateRange } from "@/lib/modules/validators";
import { ErrorSummary, LoadingSkeletonPanel, ModuleStatePanel, ProvenanceStrip } from "./ModuleStateViews";
import styles from "./modules.module.css";

const SERIES_COLORS = ["#e2b04a", "#6ea8fe", "#5fc49a", "#f07a6a", "#c59cf5"] as const;
const SERIES_DASHES = [undefined, "6 4", "2 3", "10 4 2 4", "8 3"] as const;

function correlationStrength(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.999) return "Identidad";
  if (abs >= 0.65) return r >= 0 ? "Fuerte positiva" : "Fuerte inversa";
  if (abs >= 0.3) return r >= 0 ? "Moderada" : "Moderada inversa";
  return "Débil";
}

function correlationCellClass(r: number, sameAsset: boolean): string {
  if (sameAsset) return styles.matrixCellDiag;
  if (r <= -0.05) return styles.matrixCellNeg;
  if (r >= 0.65) return styles.matrixCellStrongPos;
  if (r >= 0.3) return styles.matrixCellModPos;
  return styles.matrixCellNeutral;
}

function NormalizedSeriesChart({ data }: { data: AssetAnalysisData }) {
  const allPoints = data.series.flatMap((s) => s.points.map(([, val]) => val));
  const minVal = Math.floor((Math.min(95, ...allPoints) - 2) / 5) * 5;
  const maxVal = Math.ceil((Math.max(105, ...allPoints) + 2) / 5) * 5;
  const span = Math.max(10, maxVal - minVal);
  const w = 720;
  const h = 230;
  const padL = 46;
  const padR = 16;
  const padT = 14;
  const padB = 34;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const yTicks = [0, 0.33, 0.67, 1].map((f) => Math.round((minVal + span * f) * 10) / 10);
  const xDates = data.series[0]?.points.map(([d]) => d) ?? [];
  const xTickIndices =
    xDates.length > 2 ? [0, Math.floor((xDates.length - 1) / 2), xDates.length - 1] : xDates.map((_, i) => i);

  return (
    <section className={styles.panelCard} aria-labelledby="chart-norm-title">
      <div className={styles.panelHeader}>
        <h2 id="chart-norm-title">Evolución comparada (base 100)</h2>
        <span className={styles.panelMeta}>
          {data.effectiveFrom} a {data.effectiveTo} · {data.alignedObservations} sesiones
        </span>
      </div>
      <div className={styles.chartLegend}>
        {data.series.map((s, idx) => (
          <span key={s.symbol} className={styles.legendItem}>
            <span
              className={styles.legendSwatch}
              style={{
                background: SERIES_COLORS[idx % SERIES_COLORS.length],
                borderTop: SERIES_DASHES[idx % SERIES_DASHES.length] ? "2px dashed" : undefined,
              }}
              aria-hidden="true"
            />
            {s.symbol}
          </span>
        ))}
      </div>
      <figure className={styles.chartFrame}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className={styles.chartSvg}
          role="img"
          aria-label={`Gráfico lineal de evolución normalizada base 100 entre ${data.effectiveFrom} y ${data.effectiveTo}`}
        >
          {yTicks.map((tick) => {
            const y = padT + innerH - ((tick - minVal) / span) * innerH;
            return (
              <g key={tick}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--surface-2)" strokeWidth={1} />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
                  {tick}
                </text>
              </g>
            );
          })}
          {xTickIndices.map((idx) => {
            const ratio = xDates.length <= 1 ? 0 : idx / (xDates.length - 1);
            const x = padL + ratio * innerW;
            return (
              <text key={idx} x={x} y={h - 10} textAnchor={idx === 0 ? "start" : idx === xDates.length - 1 ? "end" : "middle"} fontSize="12" fill="var(--muted)">
                {xDates[idx]}
              </text>
            );
          })}
          {data.series.map((s, idx) => {
            const d = s.points
              .map(([, val], i) => {
                const px = padL + (s.points.length <= 1 ? 0 : (i / (s.points.length - 1)) * innerW);
                const py = padT + innerH - ((val - minVal) / span) * innerH;
                return `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
              })
              .join(" ");
            return (
              <path
                key={s.symbol}
                d={d}
                fill="none"
                stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                strokeWidth={2}
                strokeDasharray={SERIES_DASHES[idx % SERIES_DASHES.length]}
              />
            );
          })}
        </svg>
        <figcaption className={styles.chartCaption}>
          Todas las series parten en 100 en la primera fecha alineada ({data.effectiveFrom}).
        </figcaption>
      </figure>
      <details className={styles.chartDetails}>
        <summary>Ver tabla de puntos normalizados</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                {data.series.map((s) => (
                  <th key={s.symbol} scope="col" className="num">
                    {s.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {xDates.map((date, rowIdx) => (
                <tr key={date}>
                  <th scope="row">{date}</th>
                  {data.series.map((s) => (
                    <td key={s.symbol} className="num">
                      {formatRatio(s.points[rowIdx]?.[1], 2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function AssetAnalysisView({
  result,
  basePath,
  currentScenario,
  initialSymbols,
  initialPeriod,
  initialReturnKind,
  initialFrom,
  initialTo,
}: {
  result: AdapterResult<AssetAnalysisData>;
  basePath: string;
  currentScenario: ViewScenario;
  initialSymbols: string[];
  initialPeriod: PeriodPreset;
  initialReturnKind: ReturnKind;
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const [symbols, setSymbols] = useState<string[]>(initialSymbols);
  const [period, setPeriod] = useState<PeriodPreset>(initialPeriod);
  const [returnKind, setReturnKind] = useState<ReturnKind>(initialReturnKind);
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [clientIssues, setClientIssues] = useState<{ field: string; message: string }[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [selectedPair, setSelectedPair] = useState<[number, number] | null>(
    result.status === "ok" && result.data.correlationSymbols.length >= 2 ? [0, 1] : null,
  );

  const catalogOptions =
    result.status === "ok"
      ? result.data.catalog
      : [
          { id: 1, symbol: "AAPL", name: "Apple Inc.", currency: "USD", availableObservations: 756 },
          { id: 2, symbol: "MSFT", name: "Microsoft Corp.", currency: "USD", availableObservations: 756 },
          { id: 3, symbol: "JPM", name: "JPMorgan Chase & Co.", currency: "USD", availableObservations: 756 },
          { id: 4, symbol: "WALMEX.MX", name: "Wal-Mart de México", currency: "MXN", availableObservations: 756 },
          { id: 5, symbol: "XOM", name: "Exxon Mobil Corp.", currency: "USD", availableObservations: 756 },
          { id: 6, symbol: "NU", name: "Nu Holdings (muestra corta)", currency: "USD", availableObservations: 12 },
        ];

  function navigateQuery(next: {
    symbols: string[];
    period: PeriodPreset;
    returnKind: ReturnKind;
    from: string;
    to: string;
  }) {
    const q = new URLSearchParams();
    if (currentScenario !== "normal") q.set("escenario", currentScenario);
    q.set("activos", next.symbols.join(","));
    q.set("periodo", next.period);
    q.set("retorno", next.returnKind);
    if (next.period === "custom") {
      q.set("desde", next.from);
      q.set("hasta", next.to);
    }
    router.push(`${basePath}?${q.toString()}`);
  }

  function handleApply(e: React.FormEvent) {
    e.preventDefault();
    const issues: { field: string; message: string }[] = [];
    if (symbols.length === 0) {
      issues.push({ field: "asset-selector", message: "Selecciona al menos un activo para analizar." });
    }
    if (period === "custom") {
      issues.push(...validateDateRange(fromDate, toDate));
    }
    if (issues.length > 0) {
      setClientIssues(issues);
      setFocusKey((k) => k + 1);
      return;
    }
    setClientIssues([]);
    navigateQuery({ symbols, period, returnKind, from: fromDate, to: toDate });
  }

  function toggleSymbol(symbol: string) {
    setSymbols((current) =>
      current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol],
    );
  }

  const resetView = () => router.push(basePath);

  if (result.status === "not_integrated") {
    return (
      <div className={styles.viewRoot}>
        <h1 className={styles.pageTitle}>Análisis cuantitativo de activos</h1>
        <ModuleStatePanel result={result} />
      </div>
    );
  }

  const bestAsset =
    result.status === "ok" && result.data.metrics.length > 0
      ? [...result.data.metrics].sort((a, b) => (b.cumulativeReturn ?? -99) - (a.cumulativeReturn ?? -99))[0]
      : null;

  const pairDetails =
    result.status === "ok" &&
    selectedPair &&
    result.data.correlationSymbols[selectedPair[0]] &&
    result.data.correlationSymbols[selectedPair[1]]
      ? {
          a: result.data.correlationSymbols[selectedPair[0]],
          b: result.data.correlationSymbols[selectedPair[1]],
          r: result.data.correlationMatrix[selectedPair[0]]?.[selectedPair[1]] ?? null,
        }
      : null;

  return (
    <div className={styles.viewRoot}>
      <div className={styles.pageHeadMeta}>
        <div>
          <h1 className={styles.pageTitle}>Análisis cuantitativo de activos</h1>
          <p className={styles.pageLead}>
            Compara rendimientos simples o logarítmicos, volatilidad anualizada, drawdown máximo y correlación histórica
            entre activos sobre sesiones hábiles alineadas.
          </p>
        </div>
      </div>

      <section className={styles.panelCard} style={{ marginTop: 16 }} aria-labelledby="analysis-controls-title">
        <div className={styles.panelHeader}>
          <h2 id="analysis-controls-title">Selección de activos y período</h2>
          <span className={styles.panelMeta}>RF-15 a RF-20 · incluye caso NU (12 sesiones) para validar RF-20</span>
        </div>

        <form onSubmit={handleApply} noValidate>
          <fieldset id="asset-selector" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className={styles.panelMeta}>Activos a comparar</legend>
            <div className={styles.assetChecklist}>
              {catalogOptions.map((item) => (
                <label key={item.symbol} className={styles.assetCheckLabel}>
                  <input
                    type="checkbox"
                    checked={symbols.includes(item.symbol)}
                    onChange={() => toggleSymbol(item.symbol)}
                  />
                  <span>
                    <strong>{item.symbol}</strong> ({item.currency} · {item.availableObservations} ses.)
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.toolbar} style={{ marginTop: 16 }}>
            <div>
              <span className={styles.panelMeta} style={{ display: "block", marginBottom: 6 }}>
                Período de análisis
              </span>
              <div className={styles.chipGroup} role="group" aria-label="Período de análisis">
                {(["3M", "6M", "1A", "3A", "custom"] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`${styles.chipButton} ${period === preset ? styles.chipButtonActive : ""}`}
                    aria-pressed={period === preset}
                    onClick={() => setPeriod(preset)}
                  >
                    {preset === "custom" ? "Personalizado" : preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className={styles.panelMeta} style={{ display: "block", marginBottom: 6 }}>
                Tipo de rendimiento
              </span>
              <div className={styles.chipGroup} role="group" aria-label="Tipo de rendimiento">
                {(
                  [
                    { key: "simple", label: "Simple" },
                    { key: "log", label: "Logarítmico" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.chipButton} ${returnKind === item.key ? styles.chipButtonActive : ""}`}
                    aria-pressed={returnKind === item.key}
                    onClick={() => setReturnKind(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {period === "custom" && (
              <>
                <label className="field" htmlFor="date-from">
                  <span>Desde</span>
                  <input
                    id="date-from"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </label>
                <label className="field" htmlFor="date-to">
                  <span>Hasta</span>
                  <input id="date-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </label>
              </>
            )}

            <div className={styles.toolbarActions}>
              <button type="submit" className="button button--small">
                Aplicar análisis
              </button>
            </div>
          </div>
        </form>

        <ErrorSummary issues={clientIssues} focusKey={focusKey} />
      </section>

      {currentScenario === "cargando" ? (
        <div style={{ marginTop: 20 }}>
          <LoadingSkeletonPanel title="Rendimientos y matriz de correlación" />
        </div>
      ) : result.status !== "ok" ? (
        <ModuleStatePanel result={result} onRetry={resetView} />
      ) : (
        <>
          <ProvenanceStrip provenance={result.provenance} />

          <dl className={styles.kpiStrip} aria-label="Resumen de métricas clave">
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Mejor rendimiento acumulado</dt>
              <dd className={styles.kpiLeadValue}>
                {bestAsset ? `${bestAsset.symbol} ${formatPercent(bestAsset.cumulativeReturn, { signed: true })}` : "—"}
              </dd>
              <dd className={styles.kpiSub}>
                Cálculo {result.data.returnKind === "log" ? "logarítmico" : "simple"} neto en el período
              </dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Volatilidad anualizada media</dt>
              <dd className={styles.kpiValue}>
                {formatPercent(
                  result.data.metrics.reduce((acc, row) => acc + (row.volatilityAnnualized ?? 0), 0) /
                    Math.max(1, result.data.metrics.length),
                )}
              </dd>
              <dd className={styles.kpiSub}>Factor √{result.data.annualizationFactor} días hábiles/año</dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Mayor drawdown observado</dt>
              <dd className={`${styles.kpiValue} ${styles.negativeText}`}>
                {formatPercent(
                  Math.min(...result.data.metrics.map((row) => row.maxDrawdown ?? 0)),
                  { signed: true },
                )}
              </dd>
              <dd className={styles.kpiSub}>Máxima caída histórica desde un pico local</dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Sesiones alineadas</dt>
              <dd className={styles.kpiValue}>{formatInteger(result.data.alignedObservations)}</dd>
              <dd className={styles.kpiSub}>
                {result.data.effectiveFrom} a {result.data.effectiveTo}
              </dd>
            </div>
          </dl>

          <div className={styles.splitGrid}>
            <NormalizedSeriesChart data={result.data} />

            <section className={styles.panelCard} aria-labelledby="corr-matrix-title">
              <div className={styles.panelHeader}>
                <h2 id="corr-matrix-title">Matriz de correlación (RF-17 y RF-18)</h2>
                <span className={styles.panelMeta}>Pearson diario · rango -1.00 a +1.00</span>
              </div>
              {result.data.correlationSymbols.length < 2 ? (
                <p className={styles.panelMeta}>
                  Selecciona al menos dos activos para calcular la matriz de correlación cruzada.
                </p>
              ) : (
                <>
                  <div className="table-wrap" style={{ marginTop: 8 }}>
                    <table className={styles.matrixTable}>
                      <caption className="sr-only">Matriz simétrica de correlación entre activos</caption>
                      <thead>
                        <tr>
                          <th scope="col">Activo</th>
                          {result.data.correlationSymbols.map((sym) => (
                            <th key={sym} scope="col">
                              {sym}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.correlationSymbols.map((rowSym, i) => (
                          <tr key={rowSym}>
                            <th scope="row">{rowSym}</th>
                            {result.data.correlationSymbols.map((colSym, j) => {
                              const r = result.data.correlationMatrix[i]?.[j] ?? null;
                              const isSelected = selectedPair?.[0] === i && selectedPair?.[1] === j;
                              return (
                                <td key={colSym} className={`${styles.matrixCell} ${r === null ? "" : correlationCellClass(r, i === j)}`}>
                                  <button
                                    type="button"
                                    className={`${styles.matrixButton} ${isSelected ? styles.matrixButtonSelected : ""}`}
                                    onClick={() => setSelectedPair([i, j])}
                                    aria-label={`Correlación entre ${rowSym} y ${colSym}: ${r === null ? "sin datos" : r.toFixed(2)}`}
                                  >
                                    <span>{formatRatio(r, 2)}</span>
                                    <span className={styles.matrixStrength}>{r === null ? "—" : correlationStrength(r)}</span>
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {pairDetails && (
                    <p className={styles.panelMeta} style={{ marginTop: 12 }} aria-live="polite">
                      Par seleccionado: <strong>{pairDetails.a}</strong> y <strong>{pairDetails.b}</strong> ·{" "}
                      <code>r = {formatRatio(pairDetails.r, 2)}</code> (
                      {pairDetails.r === null ? "sin cobertura común" : correlationStrength(pairDetails.r)}).
                    </p>
                  )}
                </>
              )}
            </section>
          </div>

          <section className="panel" aria-labelledby="asset-metrics-table-title">
            <div className={styles.panelHeader}>
              <h2 id="asset-metrics-table-title">Métricas de rendimiento y riesgo por activo</h2>
              <span className={styles.panelMeta}>Unidades: retornos en %, volatilidad anualizada √252</span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Activo</th>
                    <th scope="col" className="num">Sesiones</th>
                    <th scope="col" className="num">Retorno simple</th>
                    <th scope="col" className="num">Retorno log.</th>
                    <th scope="col" className="num">Media diaria</th>
                    <th scope="col" className="num">Vol. diaria</th>
                    <th scope="col" className="num">Vol. anualizada</th>
                    <th scope="col" className="num">Max drawdown</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.metrics.map((row) => (
                    <tr key={row.assetId}>
                      <th scope="row">
                        {row.symbol}
                        <span className="data-table__hint" style={{ display: "block" }}>
                          {row.name} · {row.currency}
                        </span>
                      </th>
                      <td className="num">{formatInteger(row.observations)}</td>
                      <td className="num">{formatPercent(row.simpleReturn, { signed: true })}</td>
                      <td className="num">{formatPercent(row.logReturn, { signed: true })}</td>
                      <td className="num">{formatPercent(row.meanReturnDaily, { decimals: 3, signed: true })}</td>
                      <td className="num">{formatPercent(row.volatilityDaily, { decimals: 2 })}</td>
                      <td className="num">{formatPercent(row.volatilityAnnualized, { decimals: 2 })}</td>
                      <td className="num">{formatPercent(row.maxDrawdown, { signed: true })}</td>
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

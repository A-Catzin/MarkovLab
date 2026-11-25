"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { runAssetPredictionAction, refreshAssetPredictionAction } from "@/app/app/prediccion/actions";
import { formatPercent } from "@/lib/formatters";
import type {
  AdapterResult,
  ProvenanceInfo,
  ValidationIssue,
  ViewScenario,
} from "@/lib/modules/runtime";
import type {
  PredictionData,
  PredictionMetricKind,
  PredictionSeriesPoint,
} from "@/lib/modules/types";
import {
  ErrorSummary,
  LoadingSkeletonPanel,
  ModuleStatePanel,
  ProvenanceStrip,
} from "./ModuleStateViews";
import styles from "./modules.module.css";

interface PredictionSessionRun {
  id: string;
  symbol: string;
  metric: PredictionMetricKind;
  horizonDays: 21 | 63 | 126;
  asOf: string;
  calculatedAt: string;
  point: number | null;
  data: PredictionData;
  provenance: ProvenanceInfo;
}

function describePredictionModel(
  modelName: string,
  metric: PredictionMetricKind,
  fallbackParameters: string,
): { title: string; summary: string } {
  if (modelName === "empirical_stationary_v1") {
    return {
      title: "Cuantiles históricos (P50)",
      summary:
        metric === "volatility"
          ? "Mediana y rango P5–P95 de σ₂₁ · √252 (ventana móvil de 21 sesiones)."
          : "Mediana y rango P5–P95 de rₜ = (Pₜ / Pₜ₋₁) − 1 en los últimos 252 cierres.",
    };
  }
  return { title: modelName, summary: fallbackParameters };
}

function findLastHistoricalIndex(series: PredictionSeriesPoint[]): number {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (series[i].phase === "historical") return i;
  }
  return -1;
}

function PredictionUncertaintyChart({ data }: { data: PredictionData }) {
  const vals = data.series.flatMap((p) =>
    [p.historicalValue, p.forecastPoint, p.lowerBound, p.upperBound, p.observedAfterValue].filter(
      (v): v is number => v !== null,
    ),
  );
  if (vals.length === 0) {
    return null;
  }

  const rawMin = Math.floor((Math.min(...vals) - 0.02) * 50) / 50;
  const minVal = data.metric === "volatility" ? Math.max(0, rawMin) : rawMin;
  const maxVal = Math.ceil((Math.max(...vals) + 0.02) * 50) / 50;
  const span = Math.max(0.05, maxVal - minVal);

  const w = 720;
  const h = 240;
  const padL = 56;
  const padR = 76;
  const padT = 20;
  const padB = 34;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const toX = (idx: number) =>
    padL + (data.series.length <= 1 ? 0 : (idx / (data.series.length - 1)) * innerW);
  const toY = (val: number) => padT + innerH - ((val - minVal) / span) * innerH;
  const yTicks = [0, 0.33, 0.67, 1].map((f) => minVal + span * f);

  const lastHistIndex = findLastHistoricalIndex(data.series);
  const splitX = lastHistIndex >= 0 ? toX(lastHistIndex) : padL;

  const histPath = data.series
    .map((p, idx) => (p.historicalValue === null ? null : { idx, val: p.historicalValue }))
    .filter((item): item is { idx: number; val: number } => item !== null)
    .map((item, i) => `${i === 0 ? "M" : "L"}${toX(item.idx).toFixed(1)},${toY(item.val).toFixed(1)}`)
    .join(" ");

  const forecastItems = data.series
    .map((p, idx) => ({ idx, p }))
    .filter(
      (entry): entry is { idx: number; p: PredictionSeriesPoint & { forecastPoint: number } } =>
        entry.p.phase === "forecast" && entry.p.forecastPoint !== null,
    );

  const bandItems = forecastItems.filter(
    (entry): entry is {
      idx: number;
      p: PredictionSeriesPoint & { forecastPoint: number; lowerBound: number; upperBound: number };
    } => entry.p.lowerBound !== null && entry.p.upperBound !== null,
  );

  const forecastStartX =
    lastHistIndex >= 0 ? splitX : forecastItems[0] ? toX(forecastItems[0].idx) : padL;

  const forecastPts =
    forecastItems.length > 0
      ? [
          ...(lastHistIndex >= 0 ? [{ x: forecastStartX, y: toY(forecastItems[0].p.forecastPoint) }] : []),
          ...forecastItems.map((entry) => ({ x: toX(entry.idx), y: toY(entry.p.forecastPoint) })),
        ]
      : [];
  const forecastLine = forecastPts
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(" ");

  const upperEdge =
    bandItems.length > 0
      ? [
          ...(lastHistIndex >= 0 ? [{ x: forecastStartX, y: toY(bandItems[0].p.upperBound) }] : []),
          ...bandItems.map((entry) => ({ x: toX(entry.idx), y: toY(entry.p.upperBound) })),
        ]
      : [];
  const lowerEdge =
    bandItems.length > 0
      ? [
          ...(lastHistIndex >= 0 ? [{ x: forecastStartX, y: toY(bandItems[0].p.lowerBound) }] : []),
          ...bandItems.map((entry) => ({ x: toX(entry.idx), y: toY(entry.p.lowerBound) })),
        ]
      : [];

  const upperBoundPath = upperEdge
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(" ");
  const lowerBoundPath = lowerEdge
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(" ");
  const bandPoints =
    bandItems.length > 0
      ? [...upperEdge, ...lowerEdge.slice().reverse()]
          .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
          .join(" ")
      : "";

  const observedItems = forecastItems.filter(
    (entry): entry is {
      idx: number;
      p: PredictionSeriesPoint & { forecastPoint: number; observedAfterValue: number };
    } => entry.p.observedAfterValue !== null,
  );
  const observedLine = observedItems
    .map((entry, i) => `${i === 0 ? "M" : "L"}${toX(entry.idx).toFixed(1)},${toY(entry.p.observedAfterValue).toFixed(1)}`)
    .join(" ");

  const lastBand = bandItems[bandItems.length - 1]?.p ?? null;
  const lastForecastVal = forecastItems[forecastItems.length - 1]?.p.forecastPoint ?? data.point;
  const pointLabelY = lastForecastVal !== null ? toY(lastForecastVal) : null;
  const upperLabelY = lastBand !== null ? toY(lastBand.upperBound) : null;
  const lowerLabelY = lastBand !== null ? toY(lastBand.lowerBound) : null;

  return (
    <section className={styles.panelCard} aria-labelledby="pred-chart-title">
      <div className={styles.panelHeader}>
        <h2 id="pred-chart-title">
          Trayectoria histórica, pronóstico y banda ({data.confidenceLabel})
        </h2>
        <span className={styles.panelMeta}>
          {data.metric === "volatility" ? "Volatilidad anualizada (21 ses.)" : "Rendimiento diario por sesión"} ·
          Corte: {data.trainingWindow.to}
        </span>
      </div>
      <div className={styles.chartLegend}>
        <span className={styles.legendItem}>
          <svg width="26" height="10" viewBox="0 0 26 10" className={styles.legendLineSvg} aria-hidden="true">
            <line x1="1" y1="5" x2="25" y2="5" stroke="var(--ink)" strokeWidth={2.2} strokeLinecap="round" />
          </svg>
          Histórico
        </span>
        <span className={styles.legendItem}>
          <svg width="26" height="10" viewBox="0 0 26 10" className={styles.legendLineSvg} aria-hidden="true">
            <rect x="1" y="1" width="24" height="8" rx="1.5" fill="rgb(226 176 74 / 22%)" />
            <line x1="1" y1="5" x2="25" y2="5" stroke="#e2b04a" strokeWidth={2} strokeDasharray="5 3" />
          </svg>
          Pronóstico puntual + banda
        </span>
        {data.hasPostObservations && (
          <span className={styles.legendItem}>
            <svg width="26" height="10" viewBox="0 0 26 10" className={styles.legendLineSvg} aria-hidden="true">
              <line x1="1" y1="5" x2="25" y2="5" stroke="#5fc49a" strokeWidth={2.2} strokeLinecap="round" />
            </svg>
            Valor observado
          </span>
        )}
      </div>

      <figure className={styles.chartFrame}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className={styles.chartSvg}
          role="img"
          aria-label={`Serie de ${data.selectedSymbol} con historia hasta ${data.trainingWindow.to} y banda de incertidumbre a ${data.horizonDays} días`}
        >
          {yTicks.map((tick) => {
            const y = toY(tick);
            return (
              <g key={tick}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--surface-2)" strokeWidth={1} />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
                  {formatPercent(tick, { decimals: 1 })}
                </text>
              </g>
            );
          })}
          {minVal < 0 && maxVal > 0 && (
            <line
              x1={padL}
              x2={w - padR}
              y1={toY(0)}
              y2={toY(0)}
              stroke="var(--muted)"
              strokeOpacity={0.38}
              strokeDasharray="2 3"
              strokeWidth={1}
            />
          )}
          {bandPoints && <polygon points={bandPoints} fill="rgb(226 176 74 / 16%)" />}
          {upperBoundPath && (
            <path d={upperBoundPath} fill="none" stroke="rgb(226 176 74 / 65%)" strokeWidth={1.2} strokeDasharray="3 3" />
          )}
          {lowerBoundPath && (
            <path d={lowerBoundPath} fill="none" stroke="rgb(226 176 74 / 65%)" strokeWidth={1.2} strokeDasharray="3 3" />
          )}
          <line
            x1={splitX}
            x2={splitX}
            y1={padT}
            y2={h - padB}
            stroke="var(--muted)"
            strokeDasharray="3 3"
            strokeWidth={1}
          />
          {histPath && <path d={histPath} fill="none" stroke="var(--ink)" strokeWidth={2} />}
          {forecastLine && (
            <path d={forecastLine} fill="none" stroke="#e2b04a" strokeWidth={2.2} strokeDasharray="6 4" />
          )}
          {data.hasPostObservations && observedLine && (
            <path d={observedLine} fill="none" stroke="#5fc49a" strokeWidth={2} />
          )}
          {data.hasPostObservations && observedItems.length === 1 && (
            <circle
              cx={toX(observedItems[0].idx)}
              cy={toY(observedItems[0].p.observedAfterValue)}
              r={3.5}
              fill="#5fc49a"
            />
          )}
          {lastForecastVal !== null && pointLabelY !== null && (
            <text x={w - padR + 6} y={pointLabelY + 4} fontSize="11.5" fontWeight={600} fill="#e2b04a">
              {formatPercent(lastForecastVal, { decimals: 1 })}
            </text>
          )}
          {lastBand !== null && upperLabelY !== null && pointLabelY !== null && Math.abs(pointLabelY - upperLabelY) >= 13 && (
            <text x={w - padR + 6} y={upperLabelY + 4} fontSize="11" fill="var(--muted)">
              {formatPercent(lastBand.upperBound, { decimals: 1 })}
            </text>
          )}
          {lastBand !== null && lowerLabelY !== null && pointLabelY !== null && Math.abs(lowerLabelY - pointLabelY) >= 13 && (
            <text x={w - padR + 6} y={lowerLabelY + 4} fontSize="11" fill="var(--muted)">
              {formatPercent(lastBand.lowerBound, { decimals: 1 })}
            </text>
          )}
          {[0, lastHistIndex, data.series.length - 1]
            .filter((idx, i, arr) => idx >= 0 && arr.indexOf(idx) === i)
            .map((idx) => (
              <text
                key={idx}
                x={toX(idx)}
                y={h - 10}
                textAnchor={idx === 0 ? "start" : idx === data.series.length - 1 ? "end" : "middle"}
                fontSize="12"
                fill="var(--muted)"
              >
                {data.series[idx].date}
              </text>
            ))}
        </svg>
        <figcaption className={styles.chartCaption}>
          El modelo estacionario de referencia proyecta la mediana histórica y el rango empírico por sesión individual
          ({data.confidenceLabel}), no una trayectoria acumulada. Cuando existen sesiones posteriores, el valor
          observado permite contrastar el error.
        </figcaption>
      </figure>

      <details className={styles.chartDetails}>
        <summary>Ver serie completa de pronóstico y valores observados ({data.series.length} filas)</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Tramo</th>
                <th scope="col" className="num">Histórico</th>
                <th scope="col" className="num">Lím. inferior</th>
                <th scope="col" className="num">Pronóstico</th>
                <th scope="col" className="num">Lím. superior</th>
                <th scope="col" className="num">Observado</th>
              </tr>
            </thead>
            <tbody>
              {data.series.map((row, idx) => (
                <tr key={`${row.date}-${row.phase}-${idx}`}>
                  <th scope="row">{row.dateEstimated ? `${row.date} (est.)` : row.date}</th>
                  <td>{row.phase === "historical" ? "Entrenamiento" : "Pronóstico"}</td>
                  <td className="num">{formatPercent(row.historicalValue)}</td>
                  <td className="num">{formatPercent(row.lowerBound)}</td>
                  <td className="num">{formatPercent(row.forecastPoint)}</td>
                  <td className="num">{formatPercent(row.upperBound)}</td>
                  <td className="num">{formatPercent(row.observedAfterValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function PredictionView({
  result,
  basePath,
  currentScenario,
  initialSymbol,
  initialMetric,
  initialHorizon,
  initialWithObserved,
}: {
  result: AdapterResult<PredictionData>;
  basePath: string;
  currentScenario: ViewScenario;
  initialSymbol: string;
  initialMetric: PredictionMetricKind;
  initialHorizon: 21 | 63 | 126;
  initialWithObserved: boolean;
}) {
  const router = useRouter();
  const isExampleMode = result.status === "ok" && result.provenance.isExample;

  const okResult = result.status === "ok" ? result : null;
  const initialData = okResult?.data ?? null;
  const initialProvenance = okResult?.provenance ?? null;

  const [displayedData, setDisplayedData] = useState<PredictionData | null>(initialData);
  const [displayedProvenance, setDisplayedProvenance] = useState<ProvenanceInfo | null>(initialProvenance);
  const [sessionHistory, setSessionHistory] = useState<PredictionSessionRun[]>(() =>
    initialData && initialData.activePredictionId && initialProvenance
      ? [
          {
            id: initialData.activePredictionId,
            symbol: initialData.selectedSymbol,
            metric: initialData.metric,
            horizonDays: initialData.horizonDays,
            asOf: initialData.asOf ?? initialData.trainingWindow.to,
            calculatedAt: initialData.calculatedAt,
            point: initialData.point ?? null,
            data: initialData,
            provenance: initialProvenance,
          },
        ]
      : [],
  );

  const [assetId, setAssetId] = useState<number>(
    initialData?.selectedAssetId ?? initialData?.assets[0]?.id ?? 0,
  );
  const [metric, setMetric] = useState<PredictionMetricKind>(initialData?.metric ?? initialMetric);
  const [horizonDays, setHorizonDays] = useState<21 | 63 | 126>(
    initialData?.horizonDays ?? initialHorizon,
  );
  const [asOf, setAsOf] = useState<string>(initialData?.asOf ?? "");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [execError, setExecError] = useState<{ title: string; message: string } | null>(() =>
    initialData?.predictionLoadError
      ? { title: "Pronóstico guardado no disponible", message: initialData.predictionLoadError }
      : null,
  );
  const [running, setRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function updateDemoQuery(patch: {
    symbol?: string;
    metric?: PredictionMetricKind;
    horizon?: 21 | 63 | 126;
    observed?: boolean;
  }) {
    const q = new URLSearchParams();
    if (currentScenario !== "normal") q.set("escenario", currentScenario);
    q.set("activo", patch.symbol ?? initialSymbol);
    q.set("metrica", patch.metric ?? initialMetric);
    q.set("horizonte", String(patch.horizon ?? initialHorizon));
    q.set("contraste", (patch.observed ?? initialWithObserved) ? "1" : "0");
    router.push(`${basePath}?${q.toString()}`);
  }

  async function handleGeneratePrediction(e: React.FormEvent) {
    e.preventDefault();
    if (isExampleMode || !displayedData) return;

    setIssues([]);
    setExecError(null);
    setRunning(true);
    try {
      const exec = await runAssetPredictionAction({
        assetId,
        metric,
        horizonDays,
        asOf: asOf.trim() || null,
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

      const nextData: PredictionData = {
        ...exec.prediction,
        assets: displayedData.assets,
      };
      setDisplayedData(nextData);
      setDisplayedProvenance(exec.provenance);
      setAsOf(nextData.asOf ?? "");

      if (nextData.activePredictionId) {
        const entry: PredictionSessionRun = {
          id: nextData.activePredictionId,
          symbol: nextData.selectedSymbol,
          metric: nextData.metric,
          horizonDays: nextData.horizonDays,
          asOf: nextData.asOf ?? nextData.trainingWindow.to,
          calculatedAt: nextData.calculatedAt,
          point: nextData.point ?? null,
          data: nextData,
          provenance: exec.provenance,
        };
        setSessionHistory((prev) => [entry, ...prev.filter((item) => item.id !== entry.id)]);

        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          url.searchParams.set("prediccion", nextData.activePredictionId);
          url.searchParams.set("activoId", String(assetId));
          window.history.replaceState(null, "", url.pathname + url.search);
        }
      }
      router.refresh();
    } finally {
      setRunning(false);
    }
  }

  async function handleRefreshEvaluation(predictionId: string) {
    if (isExampleMode || !displayedData) return;
    setIssues([]);
    setExecError(null);
    setRefreshing(true);
    try {
      const exec = await refreshAssetPredictionAction({ predictionId });
      if (!exec.ok) {
        setExecError({ title: exec.title, message: exec.message });
        return;
      }
      const nextData: PredictionData = {
        ...exec.prediction,
        assets: displayedData.assets,
      };
      setDisplayedData(nextData);
      setDisplayedProvenance(exec.provenance);
      setSessionHistory((prev) =>
        prev.map((item) =>
          item.id === predictionId
            ? { ...item, data: nextData, provenance: exec.provenance }
            : item,
        ),
      );
    } finally {
      setRefreshing(false);
    }
  }

  if (result.status === "not_integrated") {
    return (
      <div className={styles.viewRoot}>
        <h1 className={styles.pageTitle}>Predicción de activos</h1>
        <ModuleStatePanel result={result} />
      </div>
    );
  }

  const activeData = isExampleMode ? initialData : displayedData;
  const activeProvenance = isExampleMode ? initialProvenance : displayedProvenance;
  const hasSeries = Boolean(activeData && activeData.series.length > 0);
  const lastPoint = hasSeries && activeData ? activeData.series[activeData.series.length - 1] : null;
  const headlinePoint = activeData?.point ?? lastPoint?.forecastPoint ?? null;
  const headlineLower = activeData?.lowerBound ?? lastPoint?.lowerBound ?? null;
  const headlineUpper = activeData?.upperBound ?? lastPoint?.upperBound ?? null;

  return (
    <div className={styles.viewRoot}>
      <div className={styles.pageHeadMeta}>
        <div>
          <h1 className={styles.pageTitle}>Predicción de activos con banda de incertidumbre</h1>
          <p className={styles.pageLead}>
            Modelo estadístico de referencia para explorar rango de rendimiento o volatilidad futura. Nunca presenta un
            pronóstico como certeza ni reemplaza evidencia fuera de muestra.
          </p>
        </div>
      </div>

      {currentScenario === "cargando" ? (
        <div style={{ marginTop: 20 }}>
          <LoadingSkeletonPanel title="Pronóstico y banda de incertidumbre" />
        </div>
      ) : result.status !== "ok" ? (
        <ModuleStatePanel result={result} onRetry={() => router.push(basePath)} />
      ) : !activeData || !activeProvenance ? null : (
        <>
          <section className={styles.panelCard} style={{ marginTop: 16 }} aria-labelledby="pred-controls-title">
            <div className={styles.panelHeader}>
              <h2 id="pred-controls-title">Parámetros del pronóstico</h2>
              <span className={styles.panelMeta}>Horizonte en sesiones hábiles y fecha de corte opcional</span>
            </div>

            {isExampleMode ? (
              <div className={styles.toolbar}>
                <label className="field" htmlFor="pred-asset">
                  <span>Activo</span>
                  <select
                    id="pred-asset"
                    value={initialSymbol}
                    onChange={(e) => updateDemoQuery({ symbol: e.target.value })}
                  >
                    {activeData.assets.map((item) => (
                      <option key={item.id} value={item.symbol}>
                        {item.symbol} · {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className={styles.panelMeta} style={{ display: "block", marginBottom: 6 }}>
                    Variable pronosticada
                  </span>
                  <div className={styles.chipGroup} role="group" aria-label="Variable pronosticada">
                    <button
                      type="button"
                      className={`${styles.chipButton} ${initialMetric === "return" ? styles.chipButtonActive : ""}`}
                      aria-pressed={initialMetric === "return"}
                      onClick={() => updateDemoQuery({ metric: "return" })}
                    >
                      Rendimiento
                    </button>
                    <button
                      type="button"
                      className={`${styles.chipButton} ${initialMetric === "volatility" ? styles.chipButtonActive : ""}`}
                      aria-pressed={initialMetric === "volatility"}
                      onClick={() => updateDemoQuery({ metric: "volatility" })}
                    >
                      Volatilidad
                    </button>
                  </div>
                </div>

                <div id="pred-horizon">
                  <span className={styles.panelMeta} style={{ display: "block", marginBottom: 6 }}>
                    Horizonte (días hábiles)
                  </span>
                  <div className={styles.chipGroup} role="group" aria-label="Horizonte">
                    {([21, 63, 126] as const).map((days) => (
                      <button
                        key={days}
                        type="button"
                        className={`${styles.chipButton} ${initialHorizon === days ? styles.chipButtonActive : ""}`}
                        aria-pressed={initialHorizon === days}
                        onClick={() => updateDemoQuery({ horizon: days })}
                      >
                        {days} d
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className={styles.panelMeta} style={{ display: "block", marginBottom: 6 }}>
                    Contraste posterior
                  </span>
                  <div className={styles.chipGroup} role="group" aria-label="Modo de contraste observado">
                    <button
                      type="button"
                      className={`${styles.chipButton} ${initialWithObserved ? styles.chipButtonActive : ""}`}
                      aria-pressed={initialWithObserved}
                      onClick={() => updateDemoQuery({ observed: true })}
                    >
                      Con observados
                    </button>
                    <button
                      type="button"
                      className={`${styles.chipButton} ${!initialWithObserved ? styles.chipButtonActive : ""}`}
                      aria-pressed={!initialWithObserved}
                      onClick={() => updateDemoQuery({ observed: false })}
                    >
                      Sin observados aún
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGeneratePrediction} noValidate>
                <div className={styles.toolbar}>
                  <label className="field" htmlFor="pred-asset">
                    <span>Activo</span>
                    <select
                      id="pred-asset"
                      value={assetId}
                      onChange={(e) => {
                        const nextId = Number(e.target.value);
                        setAssetId(nextId);
                        const match = activeData.assets.find((item) => item.id === nextId);
                        if (match?.lastDate) {
                          setAsOf(match.lastDate);
                        }
                      }}
                    >
                      {activeData.assets.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.symbol}
                          {item.market ? ` (${item.market})` : ""} · {item.name}
                          {typeof item.priceRows === "number" ? ` · ${item.priceRows} cierres` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div>
                    <span className={styles.panelMeta} style={{ display: "block", marginBottom: 6 }}>
                      Variable pronosticada
                    </span>
                    <div className={styles.chipGroup} role="group" aria-label="Variable pronosticada">
                      <button
                        type="button"
                        className={`${styles.chipButton} ${metric === "return" ? styles.chipButtonActive : ""}`}
                        aria-pressed={metric === "return"}
                        onClick={() => setMetric("return")}
                      >
                        Rendimiento
                      </button>
                      <button
                        type="button"
                        className={`${styles.chipButton} ${metric === "volatility" ? styles.chipButtonActive : ""}`}
                        aria-pressed={metric === "volatility"}
                        onClick={() => setMetric("volatility")}
                      >
                        Volatilidad
                      </button>
                    </div>
                  </div>

                  <div id="pred-horizon">
                    <span className={styles.panelMeta} style={{ display: "block", marginBottom: 6 }}>
                      Horizonte (sesiones)
                    </span>
                    <div className={styles.chipGroup} role="group" aria-label="Horizonte">
                      {([21, 63, 126] as const).map((days) => (
                        <button
                          key={days}
                          type="button"
                          className={`${styles.chipButton} ${horizonDays === days ? styles.chipButtonActive : ""}`}
                          aria-pressed={horizonDays === days}
                          onClick={() => setHorizonDays(days)}
                        >
                          {days} d
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="field" htmlFor="pred-as-of">
                    <span>Fecha de corte (opcional)</span>
                    <input
                      id="pred-as-of"
                      type="date"
                      value={asOf}
                      onChange={(e) => setAsOf(e.target.value)}
                    />
                  </label>

                  <div className={styles.toolbarActions}>
                    <button type="submit" className="button" disabled={running || refreshing} aria-busy={running}>
                      {running ? "Generando…" : "Generar pronóstico"}
                    </button>
                    {activeData.activePredictionId && (
                      <button
                        type="button"
                        className="button button--quiet"
                        disabled={refreshing || running}
                        aria-busy={refreshing}
                        onClick={() => handleRefreshEvaluation(activeData.activePredictionId!)}
                      >
                        {refreshing ? "Actualizando…" : "Actualizar contraste observado"}
                      </button>
                    )}
                  </div>
                </div>
                <p className={styles.panelMeta} style={{ marginTop: 8 }}>
                  Si eliges una fecha de corte pasada con cierres posteriores registrados, podrás contrastar el pronóstico
                  frente a los valores observados sin reentrenar el modelo.
                </p>
              </form>
            )}

            <ErrorSummary issues={issues} focusKey={focusKey} />
            {execError && (
              <div className="notice notice--error" role="alert" style={{ marginTop: 14 }}>
                <strong>{execError.title}</strong>
                <p style={{ margin: "4px 0 0" }}>{execError.message}</p>
              </div>
            )}
          </section>

          <ProvenanceStrip provenance={activeProvenance} />

          {!hasSeries ? (
            <section className={styles.panelCard} style={{ marginTop: 20 }}>
              <h2 style={{ marginTop: 0 }}>Sin pronóstico generado todavía</h2>
              <p style={{ color: "var(--muted)", marginBottom: 0 }}>
                Elige un activo con al menos 60 cierres históricos, define variable, horizonte y fecha de corte opcional, y
                presiona <strong>Generar pronóstico</strong> para persistir y evaluar el resultado.
              </p>
            </section>
          ) : (
            <>
              <dl className={styles.kpiStrip} aria-label="Resumen del pronóstico">
                <div className={styles.kpiCell}>
                  <dt className={styles.kpiLabel}>
                    {activeData.metric === "return"
                      ? "Rendimiento por sesión (mediana)"
                      : "Volatilidad anualizada (mediana)"}
                  </dt>
                  <dd className={styles.kpiLeadValue}>{formatPercent(headlinePoint, { signed: activeData.metric === "return" })}</dd>
                  <dd className={styles.kpiSub}>
                    Banda ({activeData.confidenceLabel}):{" "}
                    {formatPercent(headlineLower, { signed: activeData.metric === "return" })} a{" "}
                    {formatPercent(headlineUpper, { signed: activeData.metric === "return" })}
                  </dd>
                </div>
                {(() => {
                  const modelInfo = describePredictionModel(
                    activeData.modelName,
                    activeData.metric,
                    activeData.modelParameters,
                  );
                  return (
                    <div className={styles.kpiCell}>
                      <dt className={styles.kpiLabel}>Modelo y parámetros</dt>
                      <dd className={styles.kpiValue}>{modelInfo.title}</dd>
                      <dd className={styles.kpiSub}>{modelInfo.summary}</dd>
                    </div>
                  );
                })()}
                <div className={styles.kpiCell}>
                  <dt className={styles.kpiLabel}>Ventana de entrenamiento</dt>
                  <dd className={styles.kpiValue}>{activeData.trainingWindow.observations} obs.</dd>
                  <dd className={styles.kpiSub}>
                    {activeData.trainingWindow.from} a {activeData.trainingWindow.to}
                  </dd>
                </div>
                <div className={styles.kpiCell}>
                  <dt className={styles.kpiLabel}>Evaluación posterior</dt>
                  <dd className={styles.kpiValue}>
                    {activeData.evaluation ? `MAE ${formatPercent(activeData.evaluation.mae)}` : "Pendiente"}
                  </dd>
                  <dd className={styles.kpiSub}>
                    {activeData.evaluation
                      ? `${activeData.evaluation.observedPoints} ses. obs. · RMSE ${formatPercent(activeData.evaluation.rmse)} · Cobertura ${formatPercent(activeData.evaluation.intervalCoverage)}`
                      : "Todavía no hay cierres observados posteriores al corte"}
                  </dd>
                </div>
              </dl>

              <div className={styles.splitGrid}>
                <PredictionUncertaintyChart data={activeData} />

                <section className={styles.panelCard} aria-labelledby="pred-limitations-title">
                  <div className={styles.panelHeader}>
                    <h2 id="pred-limitations-title">Limitaciones del modelo</h2>
                    <span className={`${styles.pill} ${styles.pillWarning}`}>Solo referencia estadística</span>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      display: "grid",
                      gap: 10,
                      color: "var(--muted)",
                      fontSize: "0.9375rem",
                      lineHeight: 1.5,
                    }}
                  >
                    {activeData.limitations.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                  {activeData.activePredictionId && (
                    <p className={styles.panelMeta} style={{ marginTop: 14 }}>
                      ID persistido: <code>{activeData.activePredictionId}</code> · Calculado:{" "}
                      {activeData.calculatedAt}
                    </p>
                  )}
                </section>
              </div>
            </>
          )}

          {!isExampleMode && sessionHistory.length > 0 && (
            <section className="panel" style={{ marginTop: 20 }} aria-labelledby="pred-history-title">
              <div className={styles.panelHeader}>
                <h2 id="pred-history-title">Pronósticos consultados en esta sesión</h2>
                <span className={styles.panelMeta}>Cada UUID conserva su entrenamiento original sin reentrenar</span>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Activo</th>
                      <th scope="col">Métrica</th>
                      <th scope="col">Horizonte</th>
                      <th scope="col">Corte</th>
                      <th scope="col" className="num">Estimación puntual</th>
                      <th scope="col" className="data-table__action">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionHistory.map((item) => (
                      <tr key={item.id}>
                        <th scope="row">{item.symbol}</th>
                        <td>{item.metric === "return" ? "Rendimiento" : "Volatilidad"}</td>
                        <td>{item.horizonDays} sesiones</td>
                        <td>{item.asOf}</td>
                        <td className="num">
                          {formatPercent(item.point, { signed: item.metric === "return" })}
                        </td>
                        <td className="data-table__action">
                          <button
                            type="button"
                            className="button button--small button--quiet"
                            disabled={refreshing || running}
                            onClick={() => handleRefreshEvaluation(item.id)}
                          >
                            {activeData.activePredictionId === item.id ? "Reconsultar" : "Cargar"}
                          </button>
                        </td>
                      </tr>
                    ))}
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

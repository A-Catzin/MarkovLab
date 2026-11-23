"use client";

import { useRouter } from "next/navigation";
import { formatPercent } from "@/lib/formatters";
import type { AdapterResult, ViewScenario } from "@/lib/modules/runtime";
import type { PredictionData, PredictionMetricKind } from "@/lib/modules/types";
import { LoadingSkeletonPanel, ModuleStatePanel, ProvenanceStrip } from "./ModuleStateViews";
import styles from "./modules.module.css";

function PredictionUncertaintyChart({ data }: { data: PredictionData }) {
  const vals = data.series.flatMap((p) =>
    [p.historicalValue, p.lowerBound, p.upperBound, p.observedAfterValue].filter((v): v is number => v !== null),
  );
  const minVal = Math.floor((Math.min(...vals) - 0.02) * 50) / 50;
  const maxVal = Math.ceil((Math.max(...vals) + 0.02) * 50) / 50;
  const span = Math.max(0.05, maxVal - minVal);

  const w = 720;
  const h = 235;
  const padL = 56;
  const padR = 20;
  const padT = 18;
  const padB = 34;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const toX = (idx: number) => padL + (data.series.length <= 1 ? 0 : (idx / (data.series.length - 1)) * innerW);
  const toY = (val: number) => padT + innerH - ((val - minVal) / span) * innerH;
  const yTicks = [0, 0.33, 0.67, 1].map((f) => minVal + span * f);

  const lastHistIndex = data.series.findLastIndex((p) => p.phase === "historical");
  const splitX = lastHistIndex >= 0 ? toX(lastHistIndex) : padL;

  const histPath = data.series
    .map((p, idx) => (p.historicalValue === null ? null : { idx, val: p.historicalValue }))
    .filter((item): item is { idx: number; val: number } => item !== null)
    .map((item, i) => `${i === 0 ? "M" : "L"}${toX(item.idx).toFixed(1)},${toY(item.val).toFixed(1)}`)
    .join(" ");

  const forecastItems = data.series
    .map((p, idx) => ({ idx, p }))
    .filter((entry) => entry.p.phase === "forecast" && entry.p.forecastPoint !== null);

  const anchorPoint =
    lastHistIndex >= 0 && data.series[lastHistIndex].historicalValue !== null
      ? { idx: lastHistIndex, val: data.series[lastHistIndex].historicalValue! }
      : null;

  const forecastLine = [
    ...(anchorPoint ? [anchorPoint] : []),
    ...forecastItems.map((entry) => ({ idx: entry.idx, val: entry.p.forecastPoint! })),
  ]
    .map((pt, i) => `${i === 0 ? "M" : "L"}${toX(pt.idx).toFixed(1)},${toY(pt.val).toFixed(1)}`)
    .join(" ");

  const upperPoly = [
    ...(anchorPoint ? [anchorPoint] : []),
    ...forecastItems.map((entry) => ({ idx: entry.idx, val: entry.p.upperBound! })),
  ];
  const lowerPoly = [
    ...forecastItems
      .slice()
      .reverse()
      .map((entry) => ({ idx: entry.idx, val: entry.p.lowerBound! })),
    ...(anchorPoint ? [anchorPoint] : []),
  ];
  const bandPoints = [...upperPoly, ...lowerPoly]
    .map((pt) => `${toX(pt.idx).toFixed(1)},${toY(pt.val).toFixed(1)}`)
    .join(" ");

  const observedLine = [
    ...(anchorPoint ? [anchorPoint] : []),
    ...forecastItems
      .filter((entry) => entry.p.observedAfterValue !== null)
      .map((entry) => ({ idx: entry.idx, val: entry.p.observedAfterValue! })),
  ]
    .map((pt, i) => `${i === 0 ? "M" : "L"}${toX(pt.idx).toFixed(1)},${toY(pt.val).toFixed(1)}`)
    .join(" ");

  return (
    <section className={styles.panelCard} aria-labelledby="pred-chart-title">
      <div className={styles.panelHeader}>
        <h2 id="pred-chart-title">
          Trayectoria histórica, pronóstico y banda ({data.confidenceLabel})
        </h2>
        <span className={styles.panelMeta}>
          Corte de entrenamiento: {data.trainingWindow.to}
        </span>
      </div>
      <div className={styles.chartLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendSwatch} style={{ background: "var(--ink)" }} aria-hidden="true" /> Histórico
        </span>
        <span className={styles.legendItem}>
          <span
            className={styles.legendSwatch}
            style={{ borderTop: "2px dashed #e2b04a" }}
            aria-hidden="true"
          />{" "}
          Pronóstico puntual + banda
        </span>
        {data.hasPostObservations && (
          <span className={styles.legendItem}>
            <span className={styles.legendSwatch} style={{ background: "#5fc49a" }} aria-hidden="true" /> Valor observado
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
          {bandPoints && <polygon points={bandPoints} fill="rgb(226 176 74 / 14%)" />}
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
          {[0, lastHistIndex, data.series.length - 1]
            .filter((idx, i, arr) => idx >= 0 && arr.indexOf(idx) === i)
            .map((idx) => (
              <text key={idx} x={toX(idx)} y={h - 10} textAnchor={idx === 0 ? "start" : idx === data.series.length - 1 ? "end" : "middle"} fontSize="12" fill="var(--muted)">
                {data.series[idx].date}
              </text>
            ))}
        </svg>
        <figcaption className={styles.chartCaption}>
          La franja dorada representa el rango estimado de incertidumbre; los valores observados posteriores (cuando
          existen) permiten contrastar el error del modelo de referencia.
        </figcaption>
      </figure>

      <details className={styles.chartDetails}>
        <summary>Ver serie completa de pronóstico y valores observados</summary>
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
              {data.series.map((row) => (
                <tr key={row.date}>
                  <th scope="row">{row.date}</th>
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

  function updateQuery(patch: {
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

  if (result.status === "not_integrated") {
    return (
      <div className={styles.viewRoot}>
        <h1 className={styles.pageTitle}>Predicción de activos (RF-21 a RF-26)</h1>
        <ModuleStatePanel result={result} />
      </div>
    );
  }

  const lastPoint = result.status === "ok" ? result.data.series[result.data.series.length - 1] : null;

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

      <section className={styles.panelCard} style={{ marginTop: 16 }} aria-labelledby="pred-controls-title">
        <div className={styles.panelHeader}>
          <h2 id="pred-controls-title">Parámetros del pronóstico (RF-21 y RF-22)</h2>
          <span className={styles.panelMeta}>Horizonte y corte seleccionables</span>
        </div>

        <div className={styles.toolbar}>
          <label className="field" htmlFor="pred-asset">
            <span>Activo</span>
            <select
              id="pred-asset"
              value={initialSymbol}
              onChange={(e) => updateQuery({ symbol: e.target.value })}
            >
              {(result.status === "ok"
                ? result.data.assets
                : [
                    { id: 1, symbol: "AAPL", name: "Apple Inc." },
                    { id: 2, symbol: "MSFT", name: "Microsoft Corp." },
                    { id: 4, symbol: "WALMEX.MX", name: "Wal-Mart de México" },
                  ]
              ).map((item) => (
                <option key={item.symbol} value={item.symbol}>
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
                onClick={() => updateQuery({ metric: "return" })}
              >
                Rendimiento
              </button>
              <button
                type="button"
                className={`${styles.chipButton} ${initialMetric === "volatility" ? styles.chipButtonActive : ""}`}
                aria-pressed={initialMetric === "volatility"}
                onClick={() => updateQuery({ metric: "volatility" })}
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
                  onClick={() => updateQuery({ horizon: days })}
                >
                  {days} d
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={styles.panelMeta} style={{ display: "block", marginBottom: 6 }}>
              Contraste posterior (RF-26)
            </span>
            <div className={styles.chipGroup} role="group" aria-label="Modo de contraste observado">
              <button
                type="button"
                className={`${styles.chipButton} ${initialWithObserved ? styles.chipButtonActive : ""}`}
                aria-pressed={initialWithObserved}
                onClick={() => updateQuery({ observed: true })}
              >
                Con observados
              </button>
              <button
                type="button"
                className={`${styles.chipButton} ${!initialWithObserved ? styles.chipButtonActive : ""}`}
                aria-pressed={!initialWithObserved}
                onClick={() => updateQuery({ observed: false })}
              >
                Sin observados aún
              </button>
            </div>
          </div>
        </div>
      </section>

      {currentScenario === "cargando" ? (
        <div style={{ marginTop: 20 }}>
          <LoadingSkeletonPanel title="Pronóstico y banda de incertidumbre" />
        </div>
      ) : result.status !== "ok" ? (
        <ModuleStatePanel result={result} onRetry={() => router.push(basePath)} />
      ) : (
        <>
          <ProvenanceStrip provenance={result.provenance} />

          <dl className={styles.kpiStrip} aria-label="Resumen del pronóstico">
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Estimación puntual al cierre</dt>
              <dd className={styles.kpiLeadValue}>{formatPercent(lastPoint?.forecastPoint, { signed: true })}</dd>
              <dd className={styles.kpiSub}>
                Banda ({result.data.confidenceLabel}): {formatPercent(lastPoint?.lowerBound, { signed: true })} a{" "}
                {formatPercent(lastPoint?.upperBound, { signed: true })}
              </dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Modelo y parámetros (RF-24)</dt>
              <dd className={styles.kpiValue}>{result.data.modelName}</dd>
              <dd className={styles.kpiSub}>{result.data.modelParameters}</dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Ventana de entrenamiento</dt>
              <dd className={styles.kpiValue}>{result.data.trainingWindow.observations} ses.</dd>
              <dd className={styles.kpiSub}>
                {result.data.trainingWindow.from} a {result.data.trainingWindow.to}
              </dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Evaluación posterior (RF-26)</dt>
              <dd className={styles.kpiValue}>
                {result.data.evaluation ? `MAE ${formatPercent(result.data.evaluation.mae)}` : "Pendiente"}
              </dd>
              <dd className={styles.kpiSub}>
                {result.data.evaluation
                  ? `RMSE ${formatPercent(result.data.evaluation.rmse)} · Cobertura ${formatPercent(result.data.evaluation.intervalCoverage)}`
                  : "Todavía no hay fechas observadas posteriores"}
              </dd>
            </div>
          </dl>

          <div className={styles.splitGrid}>
            <PredictionUncertaintyChart data={result.data} />

            <section className={styles.panelCard} aria-labelledby="pred-limitations-title">
              <div className={styles.panelHeader}>
                <h2 id="pred-limitations-title">Limitaciones del modelo (RF-25)</h2>
                <span className={`${styles.pill} ${styles.pillWarning}`}>Solo referencia estadística</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10, color: "var(--muted)", fontSize: "0.9375rem", lineHeight: 1.5 }}>
                {result.data.limitations.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

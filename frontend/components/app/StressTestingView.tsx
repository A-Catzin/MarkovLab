"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatInteger, formatMoney, formatPercent, formatRatio } from "@/lib/formatters";
import type { AdapterResult, ValidationIssue, ViewScenario } from "@/lib/modules/runtime";
import type { StressRunSummary, StressTestingData } from "@/lib/modules/types";
import { validateStressParams } from "@/lib/modules/validators";
import { ErrorSummary, LoadingSkeletonPanel, ModuleStatePanel, ProvenanceStrip } from "./ModuleStateViews";
import styles from "./modules.module.css";

function StressRangeComparisonChart({
  data,
  stressed,
  presetLabel,
}: {
  data: StressTestingData;
  stressed: StressRunSummary;
  presetLabel: string;
}) {
  const values = [
    data.capital,
    data.baseline.p5FinalValue,
    data.baseline.p95FinalValue,
    stressed.p5FinalValue,
    stressed.p95FinalValue,
  ];
  const step =
    data.capital >= 50000
      ? 10000
      : data.capital >= 5000
        ? 1000
        : Math.max(10, Math.pow(10, Math.floor(Math.log10(Math.max(10, data.capital))) - 1));
  const minVal = Math.floor((Math.min(...values) * 0.95) / step) * step;
  const maxVal = Math.ceil((Math.max(...values) * 1.05) / step) * step;
  const span = Math.max(step, maxVal - minVal);

  const w = 720;
  const h = 190;
  const padL = 110;
  const padR = 24;
  const padT = 20;
  const padB = 34;
  const innerW = w - padL - padR;

  const toX = (val: number) => padL + ((val - minVal) / span) * innerW;
  const ticks = [0, 0.33, 0.67, 1].map((f) => Math.round((minVal + span * f) / (step / 10)) * (step / 10));
  const formatTick = (val: number) =>
    Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(Math.abs(val) >= 10000 ? 0 : 1)}k` : `${Math.round(val)}`;
  const capitalX = toX(data.capital);

  const rows = [
    { label: "Base", summary: data.baseline, color: "#6ea8fe", y: 66 },
    { label: "Estrés", summary: stressed, color: "#e2b04a", y: 118 },
  ];

  return (
    <section className="panel" aria-labelledby="stress-chart-title">
      <div className={styles.panelHeader}>
        <h2 id="stress-chart-title">Rango P5 – Mediana – P95 ({presetLabel})</h2>
        <span className={styles.panelMeta}>
          Escala compartida en {data.currency} · línea punteada: capital inicial ({formatMoney(data.capital, data.currency)})
        </span>
      </div>
      <div className={styles.chartLegend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#6ea8fe" }} aria-hidden="true" /> Escenario base
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "#e2b04a" }} aria-hidden="true" /> Escenario bajo estrés
        </span>
      </div>
      <figure className={styles.chartFrame}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className={styles.chartSvg}
          role="img"
          aria-label={`Comparación de rangos P5 a P95 entre simulación base y ${presetLabel}`}
        >
          {ticks.map((tick) => {
            const x = toX(tick);
            return (
              <g key={tick}>
                <line x1={x} x2={x} y1={padT} y2={h - padB} stroke="var(--surface-2)" strokeWidth={1} />
                <text x={x} y={h - 12} textAnchor="middle" fontSize="12" fill="var(--muted)">
                  {formatTick(tick)}
                </text>
              </g>
            );
          })}
          <line
            x1={capitalX}
            x2={capitalX}
            y1={padT - 4}
            y2={h - padB}
            stroke="var(--ink)"
            strokeOpacity={0.55}
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
          {rows.map((row) => {
            const x5 = toX(row.summary.p5FinalValue);
            const x50 = toX(row.summary.medianFinalValue);
            const x95 = toX(row.summary.p95FinalValue);
            return (
              <g key={row.label}>
                <text x={padL - 12} y={row.y + 4} textAnchor="end" fontSize="13" fontWeight={600} fill="var(--ink)">
                  {row.label}
                </text>
                <line x1={x5} x2={x95} y1={row.y} y2={row.y} stroke={row.color} strokeWidth={8} strokeLinecap="round" />
                <circle cx={x50} cy={row.y} r={7} fill="#080d19" stroke={row.color} strokeWidth={3} />
              </g>
            );
          })}
        </svg>
      </figure>
      <details className={styles.chartDetails}>
        <summary>Ver comparación numérica completa Base vs Estrés</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Métrica</th>
                <th scope="col" className="num">Base</th>
                <th scope="col" className="num">Estrés</th>
                <th scope="col" className="num">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Valor mediano final</th>
                <td className="num">{formatMoney(data.baseline.medianFinalValue, data.currency)}</td>
                <td className="num">{formatMoney(stressed.medianFinalValue, data.currency)}</td>
                <td className="num">
                  {formatMoney(stressed.medianFinalValue - data.baseline.medianFinalValue, data.currency)}
                </td>
              </tr>
              <tr>
                <th scope="row">Percentil 5 (escenario adverso)</th>
                <td className="num">{formatMoney(data.baseline.p5FinalValue, data.currency)}</td>
                <td className="num">{formatMoney(stressed.p5FinalValue, data.currency)}</td>
                <td className="num">{formatMoney(stressed.p5FinalValue - data.baseline.p5FinalValue, data.currency)}</td>
              </tr>
              <tr>
                <th scope="row">VaR ({Math.round(data.confidence * 100)} %)</th>
                <td className="num">{formatMoney(data.baseline.varAmount, data.currency)}</td>
                <td className="num">{formatMoney(stressed.varAmount, data.currency)}</td>
                <td className="num">{formatMoney(stressed.varAmount - data.baseline.varAmount, data.currency)}</td>
              </tr>
              <tr>
                <th scope="row">CVaR ({Math.round(data.confidence * 100)} %)</th>
                <td className="num">{formatMoney(data.baseline.cvarAmount, data.currency)}</td>
                <td className="num">{formatMoney(stressed.cvarAmount, data.currency)}</td>
                <td className="num">{formatMoney(stressed.cvarAmount - data.baseline.cvarAmount, data.currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

export function StressTestingView({
  result,
  basePath,
  currentScenario,
}: {
  result: AdapterResult<StressTestingData>;
  basePath: string;
  currentScenario: ViewScenario;
}) {
  const router = useRouter();
  const initialPreset =
    result.status === "ok"
      ? result.data.presets.find((p) => p.presetId === result.data.activePresetId) ?? result.data.presets[0]
      : null;

  const [presetId, setPresetId] = useState(initialPreset?.presetId ?? "caida-mercado");
  const [returnShiftPct, setReturnShiftPct] = useState(
    initialPreset ? String((initialPreset.returnShift * 100).toFixed(1)) : "-18.0",
  );
  const [volMult, setVolMult] = useState(initialPreset ? String(initialPreset.volatilityMultiplier) : "1.55");
  const [corrShift, setCorrShift] = useState(initialPreset ? String(initialPreset.correlationShift) : "0.25");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [customNotice, setCustomNotice] = useState<string | null>(null);

  if (result.status === "not_integrated") {
    return (
      <div className={styles.viewRoot}>
        <h1 className={styles.pageTitle}>Escenarios de estrés (RF-46)</h1>
        <ModuleStatePanel result={result} />
      </div>
    );
  }

  function handlePresetSelect(nextPresetId: string) {
    if (result.status !== "ok") return;
    const hit = result.data.presets.find((p) => p.presetId === nextPresetId);
    if (!hit) return;
    setPresetId(hit.presetId);
    setReturnShiftPct(String((hit.returnShift * 100).toFixed(1)));
    setVolMult(String(hit.volatilityMultiplier));
    setCorrShift(String(hit.correlationShift));
    setIssues([]);
    setCustomNotice(null);
  }

  function handleValidateCustom(e: React.FormEvent) {
    e.preventDefault();
    const returnShift = Number(returnShiftPct) / 100;
    const volatilityMultiplier = Number(volMult);
    const correlationShift = Number(corrShift);
    const validation = validateStressParams({
      returnShift,
      volatilityMultiplier,
      correlationShift,
    });
    if (validation.length > 0) {
      setIssues(validation);
      setCustomNotice(null);
      setFocusKey((k) => k + 1);
      return;
    }
    setIssues([]);
    if (result.status === "ok" && !result.provenance.isExample) {
      const q = new URLSearchParams();
      if (currentScenario !== "normal") q.set("escenario", currentScenario);
      q.set("preset", "personalizado");
      q.set("retorno", String(returnShift));
      q.set("vol", String(volatilityMultiplier));
      q.set("corr", String(correlationShift));
      setCustomNotice(null);
      router.push(`${basePath}?${q.toString()}`);
      return;
    }
    setCustomNotice(
      "Parámetros matemáticamente válidos. La ejecución de choques personalizados sobre el motor Julia depende de B4; la comparación mostrada corresponde al escenario seleccionado sin alterar la cartera ni sus simulaciones previas.",
    );
  }

  const activePreset =
    result.status === "ok"
      ? result.data.presets.find((p) => p.presetId === presetId) ?? result.data.presets[0]
      : null;
  const stressed =
    result.status === "ok" && activePreset ? result.data.stressedByPreset[activePreset.presetId] : null;

  return (
    <div className={styles.viewRoot}>
      <div className={styles.pageHeadMeta}>
        <div>
          <h1 className={styles.pageTitle}>Escenarios de estrés comparativos (RF-46)</h1>
          <p className={styles.pageLead}>
            Aplica choques de rendimiento, volatilidad o correlación manteniendo exactamente el mismo horizonte, nivel de
            confianza y semilla de la simulación base. No modifica la cartera ni sus simulaciones guardadas.
          </p>
        </div>
      </div>

      {currentScenario === "cargando" ? (
        <div style={{ marginTop: 20 }}>
          <LoadingSkeletonPanel title="Simulación comparada Base vs Estrés" />
        </div>
      ) : result.status !== "ok" || !activePreset || !stressed ? (
        <ModuleStatePanel result={result.status === "ok" ? { status: "empty", title: "Sin escenario", message: "No hay datos de estrés." } : result} onRetry={() => router.push(basePath)} />
      ) : (
        <>
          <ProvenanceStrip provenance={result.provenance} />

          <section className={styles.panelCard} style={{ marginTop: 20 }} aria-labelledby="stress-controls-title">
            <div className={styles.panelHeader}>
              <h2 id="stress-controls-title">Configuración del escenario de estrés</h2>
              <span className={styles.panelMeta}>
                Parámetros compartidos: {result.data.horizonDays} días · {Math.round(result.data.confidence * 100)} % ·
                semilla {formatInteger(result.data.seed)}
              </span>
            </div>

            <div className={styles.chipGroup} role="group" aria-label="Escenarios predefinidos de estrés">
              {result.data.presets.map((preset) => (
                <button
                  key={preset.presetId}
                  type="button"
                  className={`${styles.chipButton} ${presetId === preset.presetId ? styles.chipButtonActive : ""}`}
                  aria-pressed={presetId === preset.presetId}
                  onClick={() => handlePresetSelect(preset.presetId)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className={styles.pageLead} style={{ marginTop: 10 }}>
              {activePreset.description}
            </p>

            <form onSubmit={handleValidateCustom} className={styles.toolbar} style={{ marginTop: 16 }} noValidate>
              <label className="field" htmlFor="stress-return-shift">
                <span>Choque de rendimiento (%)</span>
                <input
                  id="stress-return-shift"
                  inputMode="decimal"
                  value={returnShiftPct}
                  onChange={(e) => setReturnShiftPct(e.target.value)}
                />
              </label>
              <label className="field" htmlFor="stress-vol-mult">
                <span>Multiplicador de volatilidad (×)</span>
                <input
                  id="stress-vol-mult"
                  inputMode="decimal"
                  value={volMult}
                  onChange={(e) => setVolMult(e.target.value)}
                />
              </label>
              <label className="field" htmlFor="stress-corr-shift">
                <span>Desplazamiento de correlación</span>
                <input
                  id="stress-corr-shift"
                  inputMode="decimal"
                  value={corrShift}
                  onChange={(e) => setCorrShift(e.target.value)}
                />
              </label>
              <div className={styles.toolbarActions}>
                <button type="submit" className="button button--small">
                  {result.status === "ok" && !result.provenance.isExample ? "Simular choque" : "Validar choque"}
                </button>
              </div>
            </form>

            <ErrorSummary issues={issues} focusKey={focusKey} />
            {customNotice && (
              <p className="notice" role="status">
                {customNotice}
              </p>
            )}
          </section>

          <dl className={styles.kpiStrip} aria-label="Comparación clave Base versus Estrés">
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Mediana bajo estrés</dt>
              <dd className={styles.kpiLeadValue}>{formatMoney(stressed.medianFinalValue, result.data.currency)}</dd>
              <dd className={styles.kpiSub}>
                Base: {formatMoney(result.data.baseline.medianFinalValue, result.data.currency)} (dif.{" "}
                {formatMoney(stressed.medianFinalValue - result.data.baseline.medianFinalValue, result.data.currency)})
              </dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>VaR bajo estrés ({Math.round(result.data.confidence * 100)} %)</dt>
              <dd className={styles.kpiValue}>
                {formatMoney(stressed.varAmount, result.data.currency)}
              </dd>
              <dd className={styles.kpiSub}>
                Base: {formatMoney(result.data.baseline.varAmount, result.data.currency)} (
                {formatPercent(stressed.varFraction)})
              </dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>CVaR bajo estrés</dt>
              <dd className={styles.kpiValue}>
                {formatMoney(stressed.cvarAmount, result.data.currency)}
              </dd>
              <dd className={styles.kpiSub}>
                Base: {formatMoney(result.data.baseline.cvarAmount, result.data.currency)} (
                {formatPercent(stressed.cvarFraction)})
              </dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Parámetros fijados</dt>
              <dd className={styles.kpiValue}>Semilla {formatRatio(result.data.seed, 0)}</dd>
              <dd className={styles.kpiSub}>
                {result.data.horizonDays} días · {formatInteger(stressed.simulations)} trayectorias
              </dd>
            </div>
          </dl>

          <StressRangeComparisonChart data={result.data} stressed={stressed} presetLabel={activePreset.label} />
        </>
      )}
    </div>
  );
}

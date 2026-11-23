"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  SCENARIO_LABELS,
  type AdapterResult,
  type ProvenanceInfo,
  type ValidationIssue,
  type ViewScenario,
} from "@/lib/modules/runtime";
import { formatPeriodRange } from "@/lib/formatters";
import styles from "./modules.module.css";

const ORIGIN_LABELS: Record<ProvenanceInfo["origin"], string> = {
  fixtures: "Datos sintéticos de desarrollo",
  api: "API externa",
  csv: "Archivo CSV administrativo",
  mixed: "API y respaldo CSV",
};

const FRESHNESS_LABELS: Record<ProvenanceInfo["freshness"], string> = {
  fresh: "Actualizado",
  cached: "En caché",
  local: "Archivo local",
  example: "Datos de ejemplo",
};

export function ExampleDataBanner({ moduleName }: { moduleName: string }) {
  return (
    <div className={styles.exampleBanner} role="status">
      <span>
        <span className={styles.exampleBannerTitle}>Datos de ejemplo · Entorno local</span> — Estás viendo{" "}
        {moduleName} con series sintéticas deterministas. No se muestran ni se empaquetan en producción.
      </span>
    </div>
  );
}

export function ProvenanceStrip({ provenance }: { provenance: ProvenanceInfo }) {
  const pillClass =
    provenance.freshness === "fresh"
      ? `${styles.pill} ${styles.pillFresh}`
      : provenance.freshness === "example" || provenance.freshness === "cached"
        ? `${styles.pill} ${styles.pillWarning}`
        : `${styles.pill} ${styles.pillMuted}`;

  return (
    <div className={styles.provenanceBar} aria-label="Origen y cobertura de datos">
      <span className={pillClass}>{FRESHNESS_LABELS[provenance.freshness]}</span>
      <span className={styles.provenanceItem}>
        Origen: <strong>{ORIGIN_LABELS[provenance.origin]}</strong>
      </span>
      {provenance.effectiveRange && (
        <span className={styles.provenanceItem}>
          Período efectivo:{" "}
          <strong>{formatPeriodRange(provenance.effectiveRange.from, provenance.effectiveRange.to)}</strong> (
          {provenance.effectiveRange.observations} sesiones)
        </span>
      )}
      <span className={styles.provenanceItem}>
        Fecha de cálculo: <strong>{provenance.calculatedAt}</strong>
      </span>
      {provenance.assumptions && <span className={styles.provenanceItem}>{provenance.assumptions}</span>}
    </div>
  );
}

export function ErrorSummary({
  issues,
  title = "Revisa los campos señalados",
  focusKey,
}: {
  issues: ValidationIssue[];
  title?: string;
  focusKey?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusKey && focusKey > 0 && issues.length > 0) {
      ref.current?.focus();
    }
  }, [focusKey, issues.length]);

  if (issues.length === 0) return null;

  return (
    <div ref={ref} className={styles.errorSummary} role="alert" tabIndex={-1} aria-labelledby="error-summary-heading">
      <h2 id="error-summary-heading">{title}</h2>
      <ul>
        {issues.map((issue, index) => (
          <li key={`${issue.field}-${index}`}>
            <a href={`#${issue.field}`}>{issue.message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LoadingSkeletonPanel({ title }: { title: string }) {
  return (
    <section className={styles.panelCard} role="status" aria-busy="true" aria-label={`Cargando ${title}`}>
      <div className={styles.panelHeader}>
        <h2>{title}</h2>
        <span className={styles.panelMeta}>Cargando resultados…</span>
      </div>
      <div className={styles.skeletonStrip} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.skeletonKpiCell}>
            <div className={`${styles.skeletonBlock} ${styles.skeletonBarShort}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonBar}`} />
          </div>
        ))}
      </div>
      <div className={`${styles.skeletonBlock} ${styles.skeletonChart}`} aria-hidden="true" />
    </section>
  );
}

export function ModuleStatePanel<T>({
  result,
  onRetry,
}: {
  result: Exclude<AdapterResult<T>, { status: "ok" }>;
  onRetry?: () => void;
}) {
  if (result.status === "not_integrated") {
    return (
      <section className={`${styles.stateBox} ${styles.stateBoxWarning}`} aria-labelledby="not-integrated-heading">
        <h2 id="not-integrated-heading">{result.moduleName} no está disponible en producción todavía</h2>
        <p>{result.message}</p>
        <p>
          Estado de entrega: <strong>{result.backendDependency}</strong>. Para conservar integridad académica, no se muestran
          datos de ejemplo ni se simulan cálculos cuando la API real no está conectada.
        </p>
        <div className={styles.stateActions}>
          <Link href="/app" className="button button--small button--quiet">
            Volver al inicio del laboratorio
          </Link>
          <Link href="/app/mercado" className="button button--small">
            Ir a Seguimiento de mercado
          </Link>
        </div>
      </section>
    );
  }

  const boxClass =
    result.status === "unavailable" || result.status === "forbidden" || result.status === "validation_error"
      ? `${styles.stateBox} ${styles.stateBoxError}`
      : result.status === "insufficient_data" || result.status === "infeasible"
        ? `${styles.stateBox} ${styles.stateBoxWarning}`
        : styles.stateBox;

  const title = result.title;
  const details =
    result.status === "insufficient_data"
      ? result.details
      : result.status === "infeasible"
        ? result.conflicts
        : result.status === "validation_error"
          ? result.issues.map((item) => item.message)
          : undefined;

  return (
    <section
      className={boxClass}
      role={result.status === "unavailable" || result.status === "forbidden" ? "alert" : "status"}
    >
      <h2>{title}</h2>
      <p>{result.message}</p>
      {result.status === "insufficient_data" && result.effectiveRange && (
        <p>
          Cobertura observada: {result.effectiveRange.observations} sesiones entre {result.effectiveRange.from} y{" "}
          {result.effectiveRange.to} (mínimo requerido: {result.effectiveRange.required} sesiones).
        </p>
      )}
      {result.status === "unavailable" && result.lastUpdated && <p>Última actualización válida: {result.lastUpdated}.</p>}
      {details && details.length > 0 && (
        <ul>
          {details.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <div className={styles.stateActions}>
        {onRetry && (
          <button type="button" className="button button--small button--quiet" onClick={onRetry}>
            Restablecer vista
          </button>
        )}
        {result.status === "empty" && result.actionHref && result.actionLabel && (
          <Link href={result.actionHref} className="button button--small">
            {result.actionLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

export function ScenarioBar({
  basePath,
  currentScenario,
  scenarios,
}: {
  basePath: string;
  currentScenario: ViewScenario;
  scenarios: readonly ViewScenario[];
}) {
  return (
    <nav className={styles.scenarioBar} aria-label="Estados de prueba de la vista local">
      <span className={styles.panelMeta}>Escenario de prueba</span>
      <div className={styles.scenarioBarLinks}>
        {scenarios.map((scenario) => (
          <Link
            key={scenario}
            href={scenario === "normal" ? basePath : `${basePath}?escenario=${scenario}`}
            className={`${styles.scenarioLink} ${currentScenario === scenario ? styles.scenarioLinkActive : ""}`}
            aria-current={currentScenario === scenario ? "page" : undefined}
          >
            {SCENARIO_LABELS[scenario]}
          </Link>
        ))}
      </div>
    </nav>
  );
}

"use client";

import { useMemo, useState } from "react";
import { formatInteger } from "@/lib/formatters";
import type { AdapterResult, ModuleCode, ViewScenario } from "@/lib/modules/runtime";
import type { ReportsData } from "@/lib/modules/types";
import { LoadingSkeletonPanel, ModuleStatePanel, ProvenanceStrip } from "./ModuleStateViews";
import styles from "./modules.module.css";

const FRESHNESS_LABELS = {
  fresh: "Actualizado",
  cached: "En caché",
  local: "CSV local",
  example: "Datos de ejemplo",
} as const;

export function ReportsView({
  result,
  currentScenario,
}: {
  result: AdapterResult<ReportsData>;
  currentScenario: ViewScenario;
}) {
  const [moduleFilter, setModuleFilter] = useState<ModuleCode | "ALL">("ALL");
  const [selectedFormulaId, setSelectedFormulaId] = useState("simple-log-return");

  const filteredReports = useMemo(() => {
    if (result.status !== "ok") return [];
    if (moduleFilter === "ALL") return result.data.reports;
    return result.data.reports.filter((item) => item.moduleCode === moduleFilter);
  }, [result, moduleFilter]);

  if (result.status === "not_integrated") {
    return (
      <div className={styles.viewRoot}>
        <h1 className={styles.pageTitle}>Reportes y detalle matemático (RF-54 a RF-58)</h1>
        <ModuleStatePanel result={result} />
      </div>
    );
  }

  const activeFormula =
    result.status === "ok"
      ? result.data.formulas.find((f) => f.id === selectedFormulaId) ?? result.data.formulas[0]
      : null;

  return (
    <div className={styles.viewRoot}>
      <div className={styles.pageHeadMeta}>
        <div>
          <h1 className={styles.pageTitle}>Reportes consolidados y detalle matemático</h1>
          <p className={styles.pageLead}>
            Consolida resultados por período, fecha de cálculo y fuente de datos; expone las fórmulas matemáticas de
            cada indicador y controla la exportación CSV según disponibilidad real del backend.
          </p>
        </div>
      </div>

      {currentScenario === "cargando" ? (
        <div style={{ marginTop: 20 }}>
          <LoadingSkeletonPanel title="Reportes y detalle matemático" />
        </div>
      ) : result.status !== "ok" ? (
        <ModuleStatePanel result={result} />
      ) : (
        <>
          <ProvenanceStrip provenance={result.provenance} />

          <dl className={styles.kpiStrip} aria-label="Resumen de reportes">
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Análisis listados</dt>
              <dd className={styles.kpiLeadValue}>{formatInteger(filteredReports.length)}</dd>
              <dd className={styles.kpiSub}>Filtro activo: {moduleFilter === "ALL" ? "Todos" : moduleFilter}</dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Métricas documentadas</dt>
              <dd className={styles.kpiValue}>{formatInteger(result.data.formulas.length)}</dd>
              <dd className={styles.kpiSub}>Fórmula, unidad y supuestos explícitos (RF-56)</dd>
            </div>
            <div className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>Exportación CSV (RF-58)</dt>
              <dd className={styles.kpiValue}>
                {result.data.exportCapabilities.csvAvailable ? "Disponible" : "Pendiente B8"}
              </dd>
              <dd className={styles.kpiSub}>Nunca genera archivos falsos con datos de prueba</dd>
            </div>
          </dl>

          <section className="panel" aria-labelledby="reports-list-title">
            <div className={styles.panelHeader}>
              <h2 id="reports-list-title">Análisis consolidados (RF-54 y RF-57)</h2>
              <div className={styles.chipGroup} role="group" aria-label="Filtrar reportes por módulo">
                {(["ALL", "F1", "F3", "F4", "F5", "F6"] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`${styles.chipButton} ${moduleFilter === code ? styles.chipButtonActive : ""}`}
                    aria-pressed={moduleFilter === code}
                    onClick={() => setModuleFilter(code)}
                  >
                    {code === "ALL" ? "Todos" : code}
                  </button>
                ))}
              </div>
            </div>

            {filteredReports.length === 0 ? (
              <p className={styles.panelMeta}>No hay reportes para el módulo {moduleFilter}.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Módulo</th>
                      <th scope="col">Análisis y sujeto</th>
                      <th scope="col">Período y cálculo</th>
                      <th scope="col">Origen y frescura</th>
                      <th scope="col" className="num">Métrica 1</th>
                      <th scope="col" className="num">Métrica 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">{row.moduleCode}</th>
                        <td>
                          <strong>{row.title}</strong>
                          <span className="data-table__hint" style={{ display: "block" }}>
                            {row.subject} · {row.currency}
                          </span>
                        </td>
                        <td>
                          {row.periodFrom} a {row.periodTo}
                          <span className="data-table__hint" style={{ display: "block" }}>
                            Calculado: {row.calculatedAt} · {row.frequency}
                          </span>
                        </td>
                        <td>
                          <span className={`${styles.pill} ${styles.pillWarning}`}>
                            {FRESHNESS_LABELS[row.freshness]}
                          </span>
                        </td>
                        <td className="num">
                          {row.primaryMetricValue}
                          <span className="data-table__hint" style={{ display: "block" }}>
                            {row.primaryMetricLabel}
                          </span>
                        </td>
                        <td className="num">
                          {row.secondaryMetricValue}
                          <span className="data-table__hint" style={{ display: "block" }}>
                            {row.secondaryMetricLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className={styles.splitGrid}>
            <section className={styles.panelCard} aria-labelledby="formulas-title">
              <div className={styles.panelHeader}>
                <h2 id="formulas-title">Detalle matemático de métricas (RF-56)</h2>
                <span className={styles.panelMeta}>Transparencia metodológica</span>
              </div>
              <div className={styles.chipGroup} role="group" aria-label="Elegir fórmula del glosario">
                {result.data.formulas.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.chipButton} ${activeFormula?.id === item.id ? styles.chipButtonActive : ""}`}
                    aria-pressed={activeFormula?.id === item.id}
                    onClick={() => setSelectedFormulaId(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              {activeFormula && (
                <article className={styles.formulaItem} style={{ marginTop: 14 }}>
                  <div className={styles.formulaHead}>
                    <h3>{activeFormula.name}</h3>
                    <span className={`${styles.pill} ${styles.pillMuted}`}>Unidad: {activeFormula.unit}</span>
                  </div>
                  <code className={styles.formulaCode}>{activeFormula.formula}</code>
                  <p className={styles.pageLead}>{activeFormula.interpretation}</p>
                  <p className={styles.panelMeta} style={{ marginTop: 6 }}>
                    Supuestos: {activeFormula.assumptions}
                  </p>
                </article>
              )}
            </section>

            <section className={styles.panelCard} aria-labelledby="export-title">
              <div className={styles.panelHeader}>
                <h2 id="export-title">Exportación a CSV (RF-58)</h2>
                <span className={`${styles.pill} ${styles.pillWarning}`}>
                  {result.data.exportCapabilities.csvAvailable ? "Listo" : "Pendiente backend B8"}
                </span>
              </div>
              <p className={styles.pageLead}>{result.data.exportCapabilities.reasonWhenUnavailable}</p>
              <p className={styles.panelMeta} style={{ marginTop: 12 }}>
                Columnas previstas del archivo CSV:
              </p>
              <code className={styles.formulaCode}>{result.data.exportCapabilities.expectedColumns.join(", ")}</code>
              <div className={styles.actionRow} style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="button button--small button--quiet"
                  disabled={!result.data.exportCapabilities.csvAvailable}
                  aria-disabled={!result.data.exportCapabilities.csvAvailable}
                >
                  Exportar CSV (requiere B8)
                </button>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

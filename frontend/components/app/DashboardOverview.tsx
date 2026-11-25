import Link from "next/link";
import { formatInteger } from "@/lib/formatters";
import type { AdapterResult } from "@/lib/modules/runtime";
import type { DashboardOverviewData } from "@/lib/modules/types";
import { ModuleStatePanel, ProvenanceStrip } from "./ModuleStateViews";
import styles from "./modules.module.css";

export function DashboardOverview({ result }: { result: AdapterResult<DashboardOverviewData> }) {
  if (result.status !== "ok") {
    return (
      <div className={styles.viewRoot}>
        <h1 className={styles.pageTitle}>Resumen del laboratorio</h1>
        <ModuleStatePanel result={result} />
      </div>
    );
  }

  const firstName = result.data.userName?.split(" ")[0];
  const availableCount = result.data.modules.filter((m) => m.available).length;

  return (
    <div className={styles.viewRoot}>
      <div className={styles.pageHeadMeta}>
        <div>
          <h1 className={styles.pageTitle}>{firstName ? `Laboratorio · ${firstName}` : "Resumen del laboratorio"}</h1>
          <p className={styles.pageLead}>
            Estado de tus carteras, seguimiento de mercado, análisis recientes y disponibilidad real de cada módulo del
            sistema.
          </p>
        </div>
        <div className={styles.actionRow}>
          <Link href="/app/carteras/nueva" className="button button--small">
            Nueva cartera
          </Link>
          <Link href="/app/mercado" className="button button--small button--quiet">
            Mercado
          </Link>
        </div>
      </div>

      <ProvenanceStrip provenance={result.provenance} />

      <dl className={styles.kpiStrip} aria-label="Indicadores generales de la cuenta">
        <div className={styles.kpiCell}>
          <dt className={styles.kpiLabel}>Carteras registradas</dt>
          <dd className={styles.kpiLeadValue}>{formatInteger(result.data.portfolioCount)}</dd>
          <dd className={styles.kpiSub}>Acceso completo en Mis carteras</dd>
        </div>
        <div className={styles.kpiCell}>
          <dt className={styles.kpiLabel}>Activos en seguimiento</dt>
          <dd className={styles.kpiValue}>{formatInteger(result.data.watchlistCount)}</dd>
          <dd className={styles.kpiSub}>Monitoreo diario y variación por período</dd>
        </div>
        <div className={styles.kpiCell}>
          <dt className={styles.kpiLabel}>Módulos disponibles</dt>
          <dd className={styles.kpiValue}>
            {availableCount} / {result.data.modules.length}
          </dd>
          <dd className={styles.kpiSub}>{result.data.latestOriginSummary}</dd>
        </div>
      </dl>

      {result.data.recentAnalyses.length > 0 && (
        <section className="panel" aria-labelledby="dash-recent-title">
          <div className={styles.panelHeader}>
            <h2 id="dash-recent-title">Resumen de análisis recientes</h2>
            <span className={styles.panelMeta}>Incluye período y origen de cálculo</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Módulo</th>
                  <th scope="col">Análisis</th>
                  <th scope="col">Período y fecha</th>
                  <th scope="col" className="num">Indicador</th>
                  <th scope="col" className="data-table__action">Abrir</th>
                </tr>
              </thead>
              <tbody>
                {result.data.recentAnalyses.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">{item.moduleName}</th>
                    <td>{item.title}</td>
                    <td>
                      {item.periodLabel}
                      <span className="data-table__hint" style={{ display: "block" }}>
                        {item.calculatedAt}
                      </span>
                    </td>
                    <td className="num">
                      {item.headlineMetricValue}
                      <span className="data-table__hint" style={{ display: "block" }}>
                        {item.headlineMetricLabel}
                      </span>
                    </td>
                    <td className="data-table__action">
                      <Link href={item.href} className="button button--small button--quiet">
                        Inspeccionar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="dash-modules-title">
        <div className={styles.panelHeader}>
          <h2 id="dash-modules-title">Módulos del sistema</h2>
          <span className={styles.panelMeta}>Estado explícito por ruta según integración de API</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Módulo</th>
                <th scope="col">Estado</th>
                <th scope="col" className="data-table__action">Destino</th>
              </tr>
            </thead>
            <tbody>
              {result.data.modules.map((mod) => (
                <tr key={mod.name}>
                  <th scope="row">
                    {mod.name}
                    <span className="data-table__hint" style={{ display: "block" }}>
                      {mod.description}
                    </span>
                  </th>
                  <td>
                    <span
                      className={`${styles.pill} ${
                        mod.available ? styles.pillFresh : styles.pillWarning
                      }`}
                    >
                      {mod.backendStatusLabel}
                    </span>
                  </td>
                  <td className="data-table__action">
                    {mod.available ? (
                      <Link href={mod.href} className="button button--small button--quiet">
                        Abrir
                      </Link>
                    ) : (
                      <span className="data-table__hint">Sin API</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

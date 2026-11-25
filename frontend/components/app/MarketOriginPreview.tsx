"use client";

import Link from "next/link";
import { formatMoney, formatPercent } from "@/lib/formatters";
import type { AdapterResult, ViewScenario } from "@/lib/modules/runtime";
import type { MarketOriginPreviewRow } from "@/lib/modules/types";
import { LoadingSkeletonPanel, ModuleStatePanel, ProvenanceStrip } from "./ModuleStateViews";
import styles from "./modules.module.css";

const SOURCE_LABELS: Record<"api" | "csv" | "manual", string> = {
  api: "API",
  csv: "Archivo CSV",
  manual: "Manual",
};

const FRESHNESS_LABELS: Record<"updated" | "cached" | "local_file" | "unavailable" | "fresh" | "local", string> = {
  updated: "Actualizado",
  fresh: "Actualizado",
  cached: "En caché",
  local_file: "Archivo local",
  local: "Archivo local",
  unavailable: "Sin cierre disponible",
};

export function MarketOriginPreview({
  result,
  currentScenario,
  analysisHref,
}: {
  result: AdapterResult<MarketOriginPreviewRow[]>;
  currentScenario: ViewScenario;
  analysisHref: string;
}) {
  return (
    <div className={styles.viewRoot}>
      <div className={styles.pageHeadMeta}>
        <div>
          <h1 className={styles.pageTitle}>Seguimiento de mercado y origen de datos</h1>
          <p className={styles.pageLead}>
            Cada activo distingue si su último cierre proviene de API actualizada, caché reciente o archivo CSV manual,
            sin inventar etiquetas cuando el servidor no las informa.
          </p>
        </div>
        <Link href={analysisHref} className="button button--small button--quiet">
          Abrir Análisis de activos (F1)
        </Link>
      </div>

      {currentScenario === "cargando" ? (
        <div style={{ marginTop: 20 }}>
          <LoadingSkeletonPanel title="Activos en seguimiento" />
        </div>
      ) : result.status !== "ok" ? (
        <ModuleStatePanel result={result} />
      ) : (
        <>
          <ProvenanceStrip provenance={result.provenance} />
          <section className="panel" aria-labelledby="market-origin-title">
            <div className={styles.panelHeader}>
              <h2 id="market-origin-title">Activos monitoreados</h2>
              <span className={styles.panelMeta}>La actualización manual sigue disponible en /app/mercado</span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Activo</th>
                    <th scope="col">Origen y frescura</th>
                    <th scope="col" className="num">Último cierre</th>
                    <th scope="col" className="num">Día</th>
                    <th scope="col" className="num">Semana</th>
                    <th scope="col" className="num">Mes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((row) => {
                    const source = row.latestPriceSource ?? row.priceSource;
                    const status = row.latestPriceStatus ?? row.dataFreshness;
                    const pillClass =
                      status === "updated" || status === "fresh"
                        ? `${styles.pill} ${styles.pillFresh}`
                        : status === "cached"
                          ? `${styles.pill} ${styles.pillWarning}`
                          : `${styles.pill} ${styles.pillMuted}`;

                    return (
                      <tr key={row.id}>
                        <th scope="row">
                          {row.symbol}
                          <span className="data-table__hint" style={{ display: "block" }}>
                            {row.market} · {row.name}
                          </span>
                        </th>
                        <td>
                          {source && status ? (
                            <span className={pillClass}>
                              {SOURCE_LABELS[source]} · {FRESHNESS_LABELS[status]}
                            </span>
                          ) : (
                            <span className={`${styles.pill} ${styles.pillMuted}`}>Sin cierre disponible</span>
                          )}
                          {row.latestDate && (
                            <span className="data-table__hint" style={{ display: "block", marginTop: 4 }}>
                              Cierre del {row.latestDate}
                            </span>
                          )}
                        </td>
                        <td className="num">{formatMoney(row.latestPrice, row.currency)}</td>
                        <td className="num">{formatPercent(row.changes.daily, { signed: true })}</td>
                        <td className="num">{formatPercent(row.changes.weekly, { signed: true })}</td>
                        <td className="num">{formatPercent(row.changes.monthly, { signed: true })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

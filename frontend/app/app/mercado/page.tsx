import type { Metadata } from "next";
import Link from "next/link";
import { backendFetch } from "@/lib/backend";
import { requireUser } from "@/lib/guards";
import { isLocalFixturesEnabled } from "@/lib/modules/runtime";
import { formatMoney, getCatalogAssets } from "@/lib/portfolios";
import { requestMarketRefresh, updateWatchlist } from "./actions";
import styles from "./market.module.css";

type WatchedAsset = {
  id: number;
  symbol: string;
  name: string;
  market: string;
  currency: string;
  latest_price: number | null;
  latest_date: string | null;
  price_source?: "api" | "csv" | null;
  data_freshness?: "fresh" | "cached" | "local" | null;
  updated_at?: string | null;
  changes?: Record<"daily" | "weekly" | "monthly", number | null>;
};
type Point = [date: string, price: number];

const SOURCE_LABELS: Record<"api" | "csv", string> = {
  api: "API",
  csv: "Archivo CSV",
};

const FRESHNESS_LABELS: Record<"fresh" | "cached" | "local", string> = {
  fresh: "Actualizado",
  cached: "En caché",
  local: "Archivo local",
};

function provenanceSummary(item: WatchedAsset): string | null {
  if (!item.price_source && !item.data_freshness) return null;
  const source = item.price_source ? SOURCE_LABELS[item.price_source] : null;
  const freshness = item.data_freshness ? FRESHNESS_LABELS[item.data_freshness] : null;
  if (source && freshness) return `${source} · ${freshness}`;
  return source ?? freshness;
}

export const metadata: Metadata = { title: "Seguimiento de mercado · MarkovLab" };

const percent = new Intl.NumberFormat("es-MX", {
  style: "percent",
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});
const periodLabels = { daily: "Día", weekly: "Semana", monthly: "Mes" } as const;

function ClosingChart({ asset, points }: { asset: WatchedAsset; points: Point[] }) {
  if (points.length < 2) return <p>Se necesitan al menos dos cierres para mostrar el gráfico.</p>;
  const first = points[0];
  const last = points[points.length - 1];
  const start = Date.parse(first[0]);
  const span = Date.parse(last[0]) - start;
  const [min, max] = points.reduce(
    ([low, high], [, price]) => [Math.min(low, price), Math.max(high, price)],
    [first[1], first[1]],
  );
  const line = points.map(([date, price]) => [
    6 + 588 * ((Date.parse(date) - start) / span),
    min === max ? 80 : 154 - 148 * ((price - min) / (max - min)),
  ].join(",")).join(" ");

  return (
    <figure>
      <svg viewBox="0 0 600 160" preserveAspectRatio="none" className={styles.chart} role="img"
        aria-label={`Cierres de ${asset.symbol} entre ${first[0]} y ${last[0]}`}>
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2"
          vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className={styles.range}>
        <span><time dateTime={first[0]}>{first[0]}</time> · {formatMoney(first[1], asset.currency)}</span>
        <span><time dateTime={last[0]}>{last[0]}</time> · {formatMoney(last[1], asset.currency)}</span>
      </figcaption>
    </figure>
  );
}

export default async function MarketPage({ searchParams }: {
  searchParams: Promise<{ asset?: string; error?: string; refresh?: string }>;
}) {
  const user = await requireUser();
  const showPreviewLinks = isLocalFixturesEnabled();
  const { asset, error, refresh } = await searchParams;
  const [list, catalog] = await Promise.allSettled([
    backendFetch<{ assets: WatchedAsset[]; can_request_refresh?: boolean }>(
      "/api/internal/watchlist", { actorId: user.id },
    ),
    getCatalogAssets(user.id),
  ]);
  const assets = list.status === "fulfilled" ? list.value.assets : [];
  const selected = assets.find((item) => String(item.id) === asset) ?? assets[0];
  const available = catalog.status === "fulfilled"
    ? catalog.value.filter((item) => !assets.some((watched) => watched.id === item.id))
    : [];
  const history = selected
    ? await backendFetch<{ points: Point[] }>(`/api/internal/watchlist/${selected.id}/history`, {
        actorId: user.id,
      }).catch(() => null)
    : null;

  return (
    <>
      <div className="page-head">
        <h1>Seguimiento de mercado</h1>
        {showPreviewLinks && (
          <Link href="/app/mercado/analisis" className="button button--small button--quiet">
            Análisis y correlación
          </Link>
        )}
      </div>
      {error && <p className="notice notice--error" role="alert">No se pudo actualizar la lista. Inténtalo de nuevo.</p>}
      {list.status === "rejected" ? (
        <p className="notice notice--error" role="alert">No se pudo cargar tu lista. Recarga la página para volver a intentar.</p>
      ) : (
        <section className="panel" aria-labelledby="watchlist-title">
          <h2 id="watchlist-title">Activos en seguimiento</h2>
          {refresh === "accepted" && (
            <p role="status" className="notice">Solicitud registrada. Los precios cambiarán cuando haya datos nuevos.</p>
          )}
          {refresh === "no-assets" && (
            <p role="alert" className="notice notice--error">No hay activos en tu lista que puedan actualizarse.</p>
          )}
          {refresh === "unavailable" && (
            <p role="alert" className="notice notice--error">No se pudo registrar la solicitud. Inténtalo más tarde.</p>
          )}
          {list.value.can_request_refresh && assets.length > 0 && (
            <form action={requestMarketRefresh} className={styles.refresh}>
              <button type="submit" className="button button--small button--quiet">Solicitar actualización</button>
              <p className="panel__help">La actualización se procesa en segundo plano.</p>
            </form>
          )}
          {catalog.status === "rejected" ? <p role="status">El catálogo no está disponible por ahora.</p>
            : available.length > 0 && (
              <form action={updateWatchlist.bind(null, "PUT")} className={styles.form}>
                <label className="field">
                  <span>Activo del catálogo</span>
                  <select name="asset_id" required defaultValue="">
                    <option value="" disabled>Elige un activo</option>
                    {available.map((item) => (
                      <option key={item.id} value={item.id}>{item.symbol} · {item.market} · {item.name}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="button button--small">Seguir activo</button>
              </form>
            )}
          {assets.length === 0 ? <p>Aún no sigues activos. Agrega uno del catálogo para consultar sus cierres.</p> : (
            <div className="table-wrap">
              <table className={`data-table ${styles.table}`}>
                <thead><tr><th scope="col">Activo</th><th scope="col" className="num">Último cierre</th><th scope="col">Acción</th></tr></thead>
                <tbody>{assets.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      <Link href={`/app/mercado?asset=${item.id}#cierres`}
                        aria-current={selected?.id === item.id ? "true" : undefined}>{item.symbol}</Link>
                      <span className={`data-table__hint ${styles.detail}`}>{item.market} · {item.name}</span>
                    </th>
                    <td className="num">
                      {item.latest_price === null ? "Sin datos" : formatMoney(item.latest_price, item.currency)}
                      {item.latest_date && <time className={`data-table__hint ${styles.detail}`} dateTime={item.latest_date}>{item.latest_date}</time>}
                      {provenanceSummary(item) && (
                        <span className={`data-table__hint ${styles.detail}`}>
                          {provenanceSummary(item)}
                        </span>
                      )}
                      {item.changes && (
                        <dl className={styles.changes} aria-label="Variación por período">
                          {(Object.keys(periodLabels) as (keyof typeof periodLabels)[]).map((period) => {
                            const change = item.changes?.[period];
                            return (
                              <div key={period}>
                                <dt>{periodLabels[period]}</dt>
                                <dd>{change == null ? "Sin datos" : percent.format(change)}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      )}
                    </td>
                    <td>
                      <form action={updateWatchlist.bind(null, "DELETE")}>
                        <input type="hidden" name="asset_id" value={item.id} />
                        <button type="submit" className="button button--small button--quiet"
                          aria-label={`Dejar de seguir ${item.symbol}`}>Quitar</button>
                      </form>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {selected && (
        <section id="cierres" className="panel" aria-labelledby="closing-title">
          <h2 id="closing-title">Cierres históricos · {selected.symbol}</h2>
          <p className="panel__help">Cierre ajustado cuando está disponible, en {selected.currency}.</p>
          {history ? <ClosingChart asset={selected} points={history.points} />
            : <p role="alert">No se pudo cargar el histórico. Inténtalo de nuevo.</p>}
        </section>
      )}
    </>
  );
}

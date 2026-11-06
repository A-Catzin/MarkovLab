import type { Metadata } from "next";
import { AdminError } from "@/components/app/AdminError";
import { ImportForm } from "@/components/app/ImportForm";
import { IMPORT_STATUS_LABELS, formatDateTime, formatNumber, getAdminImports, loadAdmin } from "@/lib/admin";
import { requireAdmin } from "@/lib/guards";

export const metadata: Metadata = {
  title: "Importaciones · Admin · MarkovLab",
  description: "Historial de cargas de precios.",
};

/**
 * Subida de CSV (solo admins) e historial de importaciones (tabla `sincronizaciones`), de la
 * más nueva a la más vieja.
 */
export default async function AdminImportsPage() {
  const admin = await requireAdmin();
  const result = await loadAdmin(() => getAdminImports(admin.id));

  return (
    <>
      <h1>Importaciones</h1>
      <p className="shell__lead">Sube un CSV de precios y revisa las últimas 100 cargas, con su resultado.</p>
      <ImportForm />
      <h2 className="section-title">Historial</h2>
      {result.error !== null ? (
        <AdminError message={result.error} />
      ) : result.data.length === 0 ? (
        <p className="empty">Todavía no hay importaciones.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">Historial de importaciones</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Activo</th>
                <th scope="col">Estado</th>
                <th scope="col" className="num">Guardadas</th>
                <th scope="col" className="num">Fallidas</th>
                <th scope="col">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.started_at)}</td>
                  <th scope="row">
                    {item.asset_symbol ? `${item.asset_symbol} · ${item.asset_market}` : "Sin activo"}
                  </th>
                  <td>
                    <span className={`status status--${item.status}`}>{IMPORT_STATUS_LABELS[item.status]}</span>
                  </td>
                  <td className="num">{formatNumber(item.saved)}</td>
                  <td className="num">{formatNumber(item.failed)}</td>
                  <td className="data-table__message">{item.message ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

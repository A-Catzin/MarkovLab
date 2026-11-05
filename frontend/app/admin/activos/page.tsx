import type { Metadata } from "next";
import { AdminError } from "@/components/app/AdminError";
import { formatDate, formatDateTime, formatNumber, getAdminAssets, loadAdmin } from "@/lib/admin";
import { requireAdmin } from "@/lib/guards";

export const metadata: Metadata = {
  title: "Activos · Admin · MarkovLab",
  description: "Catálogo de activos y precios cargados.",
};

/** Catálogo de activos con cuántos precios tiene cada uno y qué periodo cubren. */
export default async function AdminAssetsPage() {
  const admin = await requireAdmin();
  const result = await loadAdmin(() => getAdminAssets(admin.id));

  return (
    <>
      <h1>Activos</h1>
      <p className="shell__lead">
        Activos con precios cargados. Para agregar uno, importa su CSV con <code>backend/scripts/import_prices.jl</code>.
      </p>
      {result.error !== null ? (
        <AdminError message={result.error} />
      ) : result.data.length === 0 ? (
        <p className="empty">Todavía no hay activos.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <caption className="sr-only">Activos del catálogo</caption>
            <thead>
              <tr>
                <th scope="col">Símbolo</th>
                <th scope="col">Nombre</th>
                <th scope="col">Mercado</th>
                <th scope="col">Categoría</th>
                <th scope="col">Moneda</th>
                <th scope="col" className="num">Precios</th>
                <th scope="col">Periodo</th>
                <th scope="col">Última carga</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((asset) => (
                <tr key={asset.id}>
                  <th scope="row">{asset.symbol}</th>
                  <td>{asset.name}</td>
                  <td>{asset.market}</td>
                  <td>{asset.category}</td>
                  <td>{asset.currency}</td>
                  <td className="num">{formatNumber(asset.price_rows)}</td>
                  <td>
                    {formatDate(asset.first_date)} – {formatDate(asset.last_date)}
                  </td>
                  <td>{formatDateTime(asset.last_synced_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

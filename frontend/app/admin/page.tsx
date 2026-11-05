import type { Metadata } from "next";
import Link from "next/link";
import { AdminError } from "@/components/app/AdminError";
import { IMPORT_STATUS_LABELS, formatDateTime, formatNumber, getAdminSummary, loadAdmin } from "@/lib/admin";
import { requireAdmin } from "@/lib/guards";

export const metadata: Metadata = {
  title: "Resumen · Admin · MarkovLab",
  description: "Resumen de usuarios, activos y precios cargados.",
};

/** Portada de admin: conteos de la base y la última importación. */
export default async function AdminHomePage() {
  const admin = await requireAdmin();
  const result = await loadAdmin(() => getAdminSummary(admin.id));

  return (
    <>
      <h1>Resumen</h1>
      <p className="shell__lead">Lo que hay hoy en la base de MarkovLab.</p>
      {result.error !== null ? (
        <AdminError message={result.error} />
      ) : (
        <>
          <dl className="metrics">
            <div>
              <dt>Usuarios</dt>
              <dd>{formatNumber(result.data.users)}</dd>
              <dd className="metrics__note">
                {result.data.admins === 1 ? "1 admin" : `${formatNumber(result.data.admins)} admins`} ·{" "}
                <Link href="/admin/usuarios">ver usuarios</Link>
              </dd>
            </div>
            <div>
              <dt>Activos</dt>
              <dd>{formatNumber(result.data.assets)}</dd>
              <dd className="metrics__note">
                <Link href="/admin/activos">ver catálogo</Link>
              </dd>
            </div>
            <div>
              <dt>Precios guardados</dt>
              <dd>{formatNumber(result.data.price_rows)}</dd>
              <dd className="metrics__note">filas en precios_historicos</dd>
            </div>
          </dl>

          <section className="panel" aria-labelledby="last-import">
            <h2 id="last-import">Última importación</h2>
            {result.data.last_import ? (
              <p>
                <span className={`status status--${result.data.last_import.status}`}>{IMPORT_STATUS_LABELS[result.data.last_import.status]}</span>{" "}
                {result.data.last_import.asset_symbol ?? "Sin activo"}: {formatNumber(result.data.last_import.saved)} guardadas,{" "}
                {formatNumber(result.data.last_import.failed)} fallidas · {formatDateTime(result.data.last_import.started_at)} ·{" "}
                <Link href="/admin/importaciones">ver historial</Link>
              </p>
            ) : (
              <p>
                Todavía no se importaron precios. Se cargan desde la terminal con{" "}
                <code>backend/scripts/import_prices.jl</code>.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}

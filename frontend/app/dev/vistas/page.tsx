import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { ExampleDataBanner } from "@/components/app/ModuleStateViews";
import styles from "@/components/app/modules.module.css";
import type { NavItem } from "@/components/app/NavLinks";
import { isLocalFixturesEnabled, MODULE_REGISTRY } from "@/lib/modules/runtime";

export const dynamic = "force-dynamic";

export const DEV_PREVIEW_NAV: NavItem[] = [
  { href: "/dev/vistas", label: "Índice F1–F7" },
  { href: "/dev/vistas/analisis", label: "F1 Análisis" },
  { href: "/dev/vistas/mercado", label: "F2 Mercado" },
  { href: "/dev/vistas/cartera-editar", label: "F2 Carteras" },
  { href: "/dev/vistas/estres", label: "F3 Estrés" },
  { href: "/dev/vistas/optimizacion", label: "F4 Optimización" },
  { href: "/dev/vistas/prediccion", label: "F5 Predicción" },
  { href: "/dev/vistas/backtesting", label: "F6 Backtesting" },
  { href: "/dev/vistas/reportes", label: "F7 Reportes" },
];

export default function DevViewsIndexPage() {
  if (process.env.NODE_ENV === "production" || !isLocalFixturesEnabled()) {
    notFound();
  }

  return (
    <AppShell
      user={{ email: "vista.local@ejemplo.invalid", role: "user" }}
      navItems={DEV_PREVIEW_NAV}
      signOutHref="/"
    >
      <ExampleDataBanner moduleName="el banco local de vistas F1–F7" />
      <div className={styles.pageHeadMeta}>
        <div>
          <h1>Banco local de vistas pendientes (F1–F7)</h1>
          <p className={styles.pageLead}>
            Entorno aislado de desarrollo habilitado únicamente con MARKOVLAB_USE_LOCAL_FIXTURES=1. Permite inspeccionar
            flujos, tablas, gráficos, estados de error y navegación por teclado sin alterar la autenticación de /app ni
            exponer datos sintéticos en producción.
          </p>
        </div>
      </div>

      <section className="panel" aria-labelledby="modules-table-title">
        <div className={styles.panelHeader}>
          <h2 id="modules-table-title">Inventario según PLAN_FRONTEND.md</h2>
          <span className={styles.panelMeta}>{MODULE_REGISTRY.length} entregas documentadas</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Entrega</th>
                <th scope="col">Módulo</th>
                <th scope="col">Estado actual</th>
                <th scope="col">Dependencia backend</th>
                <th scope="col" className="data-table__action">Vista previa</th>
              </tr>
            </thead>
            <tbody>
              {MODULE_REGISTRY.map((item) => (
                <tr key={item.code}>
                  <th scope="row">
                    {item.code} · {item.srsRefs}
                  </th>
                  <td>
                    <strong>{item.name}</strong>
                    <span className={`data-table__hint`} style={{ display: "block", marginTop: 2 }}>
                      {item.summary}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.pill} ${styles.pillWarning}`}>{item.deliveryState}</span>
                  </td>
                  <td>{item.backendDependency}</td>
                  <td className="data-table__action">
                    <Link href={item.devHref} className="button button--small button--quiet">
                      Abrir vista
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

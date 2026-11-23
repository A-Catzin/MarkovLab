import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { ExampleDataBanner, ScenarioBar } from "@/components/app/ModuleStateViews";
import styles from "@/components/app/modules.module.css";
import { isLocalFixturesEnabled, MODULE_REGISTRY, parseScenario, type ViewScenario } from "@/lib/modules/runtime";
import { DEV_PREVIEW_NAV } from "../page";

export const dynamic = "force-dynamic";

const DEFAULT_SCENARIOS: readonly ViewScenario[] = [
  "normal",
  "vacio",
  "pocos-datos",
  "validacion",
  "inviable",
  "no-disponible",
  "denegado",
  "cargando",
];

export default async function DevModulePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ modulo: string }>;
  searchParams: Promise<{ escenario?: string }>;
}) {
  if (process.env.NODE_ENV === "production" || !isLocalFixturesEnabled()) {
    notFound();
  }

  const { modulo } = await params;
  const { escenario } = await searchParams;
  const scenario = parseScenario(escenario);
  const entry = MODULE_REGISTRY.find((item) => item.slug === modulo);
  if (!entry) notFound();

  return (
    <AppShell
      user={{ email: "vista.local@ejemplo.invalid", role: "user" }}
      navItems={DEV_PREVIEW_NAV}
      signOutHref="/"
    >
      <ExampleDataBanner moduleName={`${entry.code} · ${entry.name}`} />
      <ScenarioBar basePath={entry.devHref} currentScenario={scenario} scenarios={DEFAULT_SCENARIOS} />
      <p className="crumbs">
        <Link href="/dev/vistas">Banco local</Link> / {entry.code} · {entry.name}
      </p>
      <section className={styles.panelCard}>
        <div className={styles.panelHeader}>
          <h1>{entry.name}</h1>
          <span className={`${styles.pill} ${styles.pillWarning}`}>{entry.deliveryState}</span>
        </div>
        <p className={styles.pageLead}>{entry.summary}</p>
        <p style={{ marginTop: 12, color: "var(--muted)" }}>
          Este módulo se conectará en su entrega correspondiente mientras conserva la estructura de adaptador en{" "}
          <code>frontend/lib/modules/adapters/</code>.
        </p>
      </section>
    </AppShell>
  );
}

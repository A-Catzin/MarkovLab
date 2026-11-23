import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { AssetAnalysisView } from "@/components/app/AssetAnalysisView";
import { ExampleDataBanner, ScenarioBar } from "@/components/app/ModuleStateViews";
import styles from "@/components/app/modules.module.css";
import { loadAssetAnalysisView } from "@/lib/modules/adapters/asset-analysis.server";
import { isLocalFixturesEnabled, MODULE_REGISTRY, parseScenario, type ViewScenario } from "@/lib/modules/runtime";
import type { PeriodPreset, ReturnKind } from "@/lib/modules/types";
import { DEV_PREVIEW_NAV } from "../page";

export const dynamic = "force-dynamic";

const DEFAULT_SCENARIOS: readonly ViewScenario[] = [
  "normal",
  "vacio",
  "pocos-datos",
  "validacion",
  "no-disponible",
  "denegado",
  "cargando",
];

const VALID_PERIODS = new Set<PeriodPreset>(["3M", "6M", "1A", "3A", "custom"]);

export default async function DevModulePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ modulo: string }>;
  searchParams: Promise<{
    escenario?: string;
    activos?: string;
    periodo?: string;
    retorno?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  if (process.env.NODE_ENV === "production" || !isLocalFixturesEnabled()) {
    notFound();
  }

  const { modulo } = await params;
  const q = await searchParams;
  const scenario = parseScenario(q.escenario);
  const entry = MODULE_REGISTRY.find((item) => item.slug === modulo);
  if (!entry) notFound();

  const symbols = q.activos
    ? q.activos
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : ["AAPL", "MSFT", "JPM", "WALMEX.MX"];
  const period: PeriodPreset = VALID_PERIODS.has(q.periodo as PeriodPreset) ? (q.periodo as PeriodPreset) : "1A";
  const returnKind: ReturnKind = q.retorno === "log" ? "log" : "simple";
  const from = q.desde ?? "2026-01-05";
  const to = q.hasta ?? "2026-10-30";

  let content: React.ReactNode = null;
  if (modulo === "analisis") {
    const result = await loadAssetAnalysisView({
      actorId: "dev-preview",
      symbols,
      period,
      from,
      to,
      returnKind,
      scenario,
    });
    content = (
      <AssetAnalysisView
        result={result}
        basePath="/dev/vistas/analisis"
        currentScenario={scenario}
        initialSymbols={symbols}
        initialPeriod={period}
        initialReturnKind={returnKind}
        initialFrom={from}
        initialTo={to}
      />
    );
  } else {
    content = (
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
    );
  }

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
      {content}
    </AppShell>
  );
}

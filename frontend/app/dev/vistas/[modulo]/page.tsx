import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, DEV_PREVIEW_NAV } from "@/components/app/AppShell";
import { AssetAnalysisView } from "@/components/app/AssetAnalysisView";
import { BacktestingView } from "@/components/app/BacktestingView";
import { DashboardOverview } from "@/components/app/DashboardOverview";
import { MarketOriginPreview } from "@/components/app/MarketOriginPreview";
import { ExampleDataBanner, LoadingSkeletonPanel, ModuleStatePanel, ScenarioBar } from "@/components/app/ModuleStateViews";
import { OptimizationView } from "@/components/app/OptimizationView";
import { PortfolioForm } from "@/components/app/PortfolioForm";
import { PortfolioVersionsPanel } from "@/components/app/PortfolioVersionsPanel";
import { PredictionView } from "@/components/app/PredictionView";
import { ReportsView } from "@/components/app/ReportsView";
import { StressTestingView } from "@/components/app/StressTestingView";
import styles from "@/components/app/modules.module.css";
import { loadAssetAnalysisView } from "@/lib/modules/adapters/asset-analysis.server";
import { loadBacktestingView } from "@/lib/modules/adapters/backtesting.server";
import { loadOptimizationView } from "@/lib/modules/adapters/optimization.server";
import { loadPortfolioEditView } from "@/lib/modules/adapters/portfolio-edit.server";
import { loadPredictionView } from "@/lib/modules/adapters/prediction.server";
import { loadDashboardOverview, loadReportsView } from "@/lib/modules/adapters/reports.server";
import { loadStressTestingView } from "@/lib/modules/adapters/stress.server";
import { isLocalFixturesEnabled, MODULE_REGISTRY, parseScenario, type ViewScenario } from "@/lib/modules/runtime";
import type { OptimizationObjective, PeriodPreset, PredictionMetricKind, ReturnKind } from "@/lib/modules/types";

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

const OPTIMIZATION_SCENARIOS: readonly ViewScenario[] = [
  "normal",
  "inviable",
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
    objetivo?: string;
    activo?: string;
    metrica?: string;
    horizonte?: string;
    contraste?: string;
  }>;
}) {
  if (process.env.NODE_ENV === "production" || !isLocalFixturesEnabled()) {
    notFound();
  }

  const { modulo } = await params;
  const q = await searchParams;
  const scenario = parseScenario(q.escenario);
  const entry =
    modulo === "dashboard"
      ? { code: "F7" as const, slug: "dashboard", name: "Dashboard consolidado", devHref: "/dev/vistas/dashboard" }
      : modulo === "mercado"
        ? { code: "F2" as const, slug: "mercado", name: "Seguimiento de mercado (RF-13)", devHref: "/dev/vistas/mercado" }
        : MODULE_REGISTRY.find((item) => item.slug === modulo);

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
  if (modulo === "dashboard") {
    const dashResult = await loadDashboardOverview({
      actorId: "dev-preview",
      userName: "Vista previa local",
      scenario,
    });
    content = <DashboardOverview result={dashResult} />;
  } else if (modulo === "analisis") {
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
  } else if (modulo === "mercado") {
    const { buildMarketOriginFixture } = await import("@/lib/modules/fixtures/market-origin.fixture");
    const marketResult = buildMarketOriginFixture(scenario);
    content = (
      <MarketOriginPreview
        result={marketResult}
        currentScenario={scenario}
        analysisHref="/dev/vistas/analisis"
      />
    );
  } else if (modulo === "cartera-editar") {
    const editResult = await loadPortfolioEditView({
      actorId: "dev-preview",
      portfolioId: "pf-v3",
      scenario,
    });
    content = (
      <div className={styles.viewRoot}>
        <h1 className={styles.pageTitle}>Edición, versiones y duplicación de cartera (F2)</h1>
        {scenario === "cargando" ? (
          <LoadingSkeletonPanel title="Edición y versiones" />
        ) : editResult.status !== "ok" ? (
          <ModuleStatePanel result={editResult} />
        ) : (
          <>
            <PortfolioForm
              assets={editResult.data.catalog}
              mode="edit"
              initialValues={{
                name: editResult.data.portfolioName,
                capital: editResult.data.capital,
                currency: editResult.data.currency,
                startDate: editResult.data.startDate,
                positions: editResult.data.positions,
              }}
              pendingBackend={editResult.data.pendingBackend}
              submitLabel="Validar cambios (pendiente B3)"
              cancelHref="/dev/vistas"
              initialShowValidationDemo={scenario === "validacion"}
            />
            <PortfolioVersionsPanel data={editResult.data} />
          </>
        )}
      </div>
    );
  } else if (modulo === "estres") {
    const stressResult = await loadStressTestingView({
      actorId: "dev-preview",
      portfolioId: "pf-v3",
      scenario,
    });
    content = (
      <StressTestingView
        result={stressResult}
        basePath="/dev/vistas/estres"
        currentScenario={scenario}
      />
    );
  } else if (modulo === "optimizacion") {
    const objective: OptimizationObjective = q.objetivo === "min_variance" ? "min_variance" : "max_sharpe";
    const optResult = await loadOptimizationView({
      actorId: "dev-preview",
      objective,
      scenario,
    });
    content = (
      <OptimizationView
        result={optResult}
        basePath="/dev/vistas/optimizacion"
        currentScenario={scenario}
        initialObjective={objective}
      />
    );
  } else if (modulo === "prediccion") {
    const symbol = q.activo ?? "AAPL";
    const metric: PredictionMetricKind = q.metrica === "volatility" ? "volatility" : "return";
    const parsedHorizon = Number(q.horizonte);
    const horizonDays: 21 | 63 | 126 = parsedHorizon === 21 || parsedHorizon === 126 ? parsedHorizon : 63;
    const withObserved = q.contraste !== "0";
    const predResult = await loadPredictionView({
      actorId: "dev-preview",
      symbol,
      metric,
      horizonDays,
      withObserved,
      scenario,
    });
    content = (
      <PredictionView
        result={predResult}
        basePath="/dev/vistas/prediccion"
        currentScenario={scenario}
        initialSymbol={symbol}
        initialMetric={metric}
        initialHorizon={horizonDays}
        initialWithObserved={withObserved}
      />
    );
  } else if (modulo === "backtesting") {
    const btResult = await loadBacktestingView({
      actorId: "dev-preview",
      scenario,
    });
    content = (
      <BacktestingView
        result={btResult}
        basePath="/dev/vistas/backtesting"
        currentScenario={scenario}
      />
    );
  } else if (modulo === "reportes") {
    const repResult = await loadReportsView({
      actorId: "dev-preview",
      scenario,
    });
    content = <ReportsView result={repResult} currentScenario={scenario} />;
  }

  return (
    <AppShell
      user={{ email: "vista.local@ejemplo.invalid", role: "user" }}
      navItems={DEV_PREVIEW_NAV}
      signOutHref="/"
    >
      <ExampleDataBanner moduleName={`${entry.code} · ${entry.name}`} />
      <ScenarioBar
        basePath={entry.devHref}
        currentScenario={scenario}
        scenarios={modulo === "optimizacion" ? OPTIMIZATION_SCENARIOS : DEFAULT_SCENARIOS}
      />
      <p className="crumbs">
        <Link href="/dev/vistas">Banco local</Link> / {entry.code} · {entry.name}
      </p>
      {content}
    </AppShell>
  );
}

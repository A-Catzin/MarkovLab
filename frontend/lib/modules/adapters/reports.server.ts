import "server-only";
import { formatPercent, formatRatio } from "@/lib/formatters";
import {
  isLocalFixturesEnabled,
  mapCommonBackendFailure,
  MODULE_REGISTRY,
  type AdapterResult,
  type DataFreshness,
  type DataOrigin,
  type ModuleCode,
  type ViewScenario,
} from "../runtime";
import type {
  DashboardModuleSummary,
  DashboardOverviewData,
  DashboardRecentAnalysis,
  MetricFormulaDoc,
  ReportAnalysisItem,
  ReportKind,
  ReportMetricValue,
  ReportsData,
} from "../types";

interface BackendReportMetric {
  id: string;
  label: string;
  unit: string;
  value: number | null;
}

interface BackendReportItem {
  id: string;
  kind: ReportKind;
  module_code: ModuleCode;
  title: string;
  subject: string;
  period_from: string | null;
  period_to: string | null;
  calculated_at: string;
  origin: string;
  freshness: string;
  frequency: string;
  currency: string | null;
  source: {
    storage: string;
    price_method: string;
    ingestion: string | null;
  };
  model: string | null;
  parameters: Record<string, unknown>;
  metrics: BackendReportMetric[];
}

interface BackendReportsSummaryResponse {
  reports: BackendReportItem[];
  formulas: MetricFormulaDoc[];
  export_capabilities: {
    csv_available: boolean;
    expected_columns: string[];
  };
  covered_kinds: string[];
}

export type ReportCsvExportResult =
  | {
      ok: true;
      status: 200;
      csv: string;
      contentType: string;
      contentDisposition: string;
    }
  | {
      ok: false;
      status: 400 | 401 | 403 | 404 | 503;
      code: string;
      message: string;
    };

const VALID_REPORT_ID_RE = /^[a-z]+:[0-9a-f-]+$/i;

function formatReportMetricValue(unit: string, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (unit === "fraction") return formatPercent(value);
  if (unit === "ratio") return formatRatio(value);
  return String(value);
}

function normalizeOrigin(raw: string): DataOrigin {
  if (raw === "api" || raw === "csv" || raw === "mixed" || raw === "fixtures") return raw;
  return "api";
}

function normalizeFreshness(raw: string): DataFreshness {
  if (raw === "fresh" || raw === "cached" || raw === "local" || raw === "example" || raw === "unknown") {
    return raw;
  }
  return "unknown";
}

function mapSummaryReport(raw: BackendReportItem): ReportAnalysisItem {
  const metrics: ReportMetricValue[] = raw.metrics.map((m) => ({
    id: m.id,
    label: m.label,
    unit: m.unit,
    value: m.value,
    formattedValue: formatReportMetricValue(m.unit, m.value),
  }));
  const first = metrics[0];
  const second = metrics[1];

  return {
    id: raw.id,
    kind: raw.kind,
    moduleCode: raw.module_code,
    title: raw.title,
    subject: raw.subject,
    periodFrom: raw.period_from ?? "—",
    periodTo: raw.period_to ?? "—",
    calculatedAt: raw.calculated_at,
    origin: normalizeOrigin(raw.origin),
    freshness: normalizeFreshness(raw.freshness),
    frequency: raw.frequency === "daily_sessions" ? "Sesiones diarias" : raw.frequency,
    currency: raw.currency?.trim() || "—",
    model: raw.model,
    sourceStorage: raw.source?.storage,
    sourcePriceMethod: raw.source?.price_method,
    parameters: raw.parameters,
    metrics,
    primaryMetricLabel: first?.label ?? "Métrica principal",
    primaryMetricValue: first?.formattedValue ?? "—",
    secondaryMetricLabel: second?.label ?? "Métrica secundaria",
    secondaryMetricValue: second?.formattedValue ?? "—",
  };
}

function resolveReportHref(report: ReportAnalysisItem): string {
  const uuid = report.id.includes(":") ? report.id.split(":", 2)[1] : "";
  if (report.kind === "prediction" && uuid) {
    return `/app/prediccion?prediccion=${encodeURIComponent(uuid)}`;
  }
  if (report.kind === "optimization") return "/app/optimizacion";
  if (report.kind === "backtest") return "/app/backtesting";
  if (report.kind === "simulation") return "/app/carteras";
  return "/app/reportes";
}

export async function loadDashboardOverview(params: {
  actorId: string;
  userName?: string | null;
  scenario?: ViewScenario;
}): Promise<AdapterResult<DashboardOverviewData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildDashboardFixture } = await import("../fixtures/reports.fixture");
    return buildDashboardFixture({
      userName: params.userName,
      scenario: params.scenario,
    });
  }

  const [{ backendFetch }, { getPortfolios }] = await Promise.all([
    import("@/lib/backend"),
    import("@/lib/portfolios"),
  ]);

  const [portfoliosRes, watchlistRes, reportsRes] = await Promise.allSettled([
    getPortfolios(params.actorId),
    backendFetch<{ assets: unknown[] }>("/api/internal/watchlist", { actorId: params.actorId }),
    backendFetch<BackendReportsSummaryResponse>("/api/internal/reports/summary?limit=5", {
      actorId: params.actorId,
    }),
  ]);

  const portfolioCount = portfoliosRes.status === "fulfilled" ? portfoliosRes.value.length : 0;
  const watchlistCount = watchlistRes.status === "fulfilled" ? watchlistRes.value.assets.length : 0;

  const recentAnalyses: DashboardRecentAnalysis[] =
    reportsRes.status === "fulfilled"
      ? reportsRes.value.reports.map((raw) => {
          const item = mapSummaryReport(raw);
          const periodLabel =
            item.periodFrom !== "—" && item.periodTo !== "—"
              ? `${item.periodFrom} a ${item.periodTo}`
              : "Ventana histórica guardada";
          return {
            id: item.id,
            moduleName: `${item.moduleCode} · ${item.title}`,
            title: item.subject,
            periodLabel,
            origin: item.origin,
            freshness: item.freshness,
            calculatedAt: item.calculatedAt,
            headlineMetricLabel: item.primaryMetricLabel,
            headlineMetricValue: item.primaryMetricValue,
            href: resolveReportHref(item),
          };
        })
      : [];

  const productionModules: DashboardModuleSummary[] = [
    {
      code: "F2",
      name: "Simulador de riesgo",
      srsRefs: "RF-41 a RF-45",
      href: "/app/simulador",
      deliveryState: "publicado",
      backendStatusLabel: "Disponible",
      description: "Reparte tu capital entre activos de ejemplo y explora 10,000 trayectorias Monte Carlo reproducibles.",
      available: true,
    },
    {
      code: "F2",
      name: "Mis carteras",
      srsRefs: "RF-27 a RF-33",
      href: "/app/carteras",
      deliveryState: "publicado",
      backendStatusLabel: "Disponible",
      description: "Crea carteras multiactivo, consulta su historial valuado en su moneda y ejecuta simulaciones guardadas.",
      available: true,
    },
    {
      code: "F2",
      name: "Seguimiento de mercado",
      srsRefs: "RF-08 a RF-13",
      href: "/app/mercado",
      deliveryState: "publicado",
      backendStatusLabel: "Disponible",
      description: "Sigue activos del catálogo, inspecciona variaciones de cierre y consulta sus series históricas.",
      available: true,
    },
    ...MODULE_REGISTRY.filter((item) => item.code !== "F2").map((item) => {
      const available = item.deliveryState === "integrado con API" || item.deliveryState === "publicado";
      return {
        code: item.code,
        name: item.name,
        srsRefs: item.srsRefs,
        href: item.appHref,
        deliveryState: item.deliveryState,
        backendStatusLabel: available
          ? "Disponible"
          : `Pendiente de API (${item.backendDependency.split("·")[0].trim()})`,
        description: item.summary,
        available,
      };
    }),
  ];

  return {
    status: "ok",
    data: {
      userName: params.userName ?? null,
      portfolioCount,
      watchlistCount,
      latestOriginSummary: "PostgreSQL del laboratorio (datos reales del usuario)",
      modules: productionModules,
      recentAnalyses,
    },
    provenance: {
      origin: "api",
      freshness: "fresh",
      isExample: false,
      calculatedAt: new Date().toISOString().slice(0, 10),
      assumptions: "Módulos F1–F7 integrados con API B1–B8",
    },
  };
}

export async function loadReportsView(params: {
  actorId: string;
  limit?: number;
  scenario?: ViewScenario;
}): Promise<AdapterResult<ReportsData>> {
  if (process.env.NODE_ENV !== "production" && isLocalFixturesEnabled()) {
    const { buildReportsFixture } = await import("../fixtures/reports.fixture");
    return buildReportsFixture(params.scenario);
  }

  try {
    const { backendFetch, BackendError } = await import("@/lib/backend");
    const limitQuery =
      typeof params.limit === "number" && Number.isInteger(params.limit)
        ? `?limit=${encodeURIComponent(String(params.limit))}`
        : "";

    try {
      const summary = await backendFetch<BackendReportsSummaryResponse>(
        `/api/internal/reports/summary${limitQuery}`,
        { actorId: params.actorId },
      );

      const reports = summary.reports.map(mapSummaryReport);
      const csvAvailable = Boolean(summary.export_capabilities?.csv_available);
      const latestDate = reports[0]?.calculatedAt
        ? reports[0].calculatedAt.slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      return {
        status: "ok",
        data: {
          reports,
          formulas: summary.formulas,
          coveredKinds: summary.covered_kinds,
          exportCapabilities: {
            csvAvailable,
            reasonWhenUnavailable: csvAvailable
              ? "El backend genera un CSV por reporte autenticado manteniendo el orden exacto de las métricas visibles."
              : "La exportación CSV está temporalmente deshabilitada en el backend.",
            expectedColumns: summary.export_capabilities?.expected_columns ?? [],
          },
        },
        provenance: {
          origin: "api",
          freshness: reports[0]?.freshness ?? "unknown",
          isExample: false,
          calculatedAt: latestDate,
          assumptions:
            "Historial persistido en PostgreSQL (simulaciones, optimizaciones, predicciones y backtests); análisis multiactivo y estrés sin persistencia no se listan",
        },
      };
    } catch (error) {
      if (error instanceof BackendError && error.status === 400) {
        return {
          status: "validation_error",
          title: "Parámetros de consulta rechazados",
          message: error.message || "El límite solicitado debe estar entre 1 y 50.",
          issues: [{ field: "reports-list-title", message: error.message || "Consulta inválida." }],
        };
      }
      throw error;
    }
  } catch (error) {
    const common = mapCommonBackendFailure<ReportsData>(
      error,
      "Servicio de reportes temporalmente no disponible",
      "No fue posible conectar con el servicio consolidado de reportes en Julia.",
    );
    if (common) return common;
    return {
      status: "unavailable",
      title: "Servicio de reportes temporalmente no disponible",
      message: "Ocurrió un error inesperado al cargar los reportes consolidados.",
    };
  }
}

export async function fetchReportCsvExport(params: {
  actorId: string;
  reportId: string;
  format?: string;
}): Promise<ReportCsvExportResult> {
  const format = params.format ?? "csv";
  if (format !== "csv") {
    return {
      ok: false,
      status: 400,
      code: "invalid_input",
      message: "El único formato admitido es csv.",
    };
  }

  const cleanId = params.reportId.trim();
  if (!VALID_REPORT_ID_RE.test(cleanId)) {
    return {
      ok: false,
      status: 404,
      code: "not_found",
      message: "El reporte solicitado no existe o pertenece a otro usuario.",
    };
  }

  const baseUrl = process.env.BACKEND_URL;
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!baseUrl || !internalKey) {
    return {
      ok: false,
      status: 503,
      code: "not_configured",
      message: "El servicio de exportación no está configurado.",
    };
  }

  let response: Response;
  try {
    response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/api/internal/reports/${cleanId}/export?format=csv`,
      {
        method: "GET",
        headers: {
          "X-Internal-Key": internalKey,
          "X-Actor-User-Id": params.actorId,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
  } catch {
    return {
      ok: false,
      status: 503,
      code: "unreachable",
      message: "No fue posible contactar con el backend de exportación.",
    };
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    const status: 400 | 401 | 403 | 404 | 503 =
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
        ? response.status
        : 503;
    return {
      ok: false,
      status,
      code: payload?.error ?? "export_error",
      message: payload?.message ?? `HTTP ${response.status}`,
    };
  }

  const csv = await response.text();
  return {
    ok: true,
    status: 200,
    csv,
    contentType: response.headers.get("content-type") ?? "text/csv; charset=utf-8",
    contentDisposition:
      response.headers.get("content-disposition") ?? 'attachment; filename="report.csv"',
  };
}

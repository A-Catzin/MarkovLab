/**
 * Contrato de ejecución, registro de módulos F1–F7 y control estricto de datos de ejemplo.
 * En producción (`NODE_ENV === "production"`) los fixtures locales permanecen siempre desactivados.
 */

export type ModuleDeliveryState = "pantalla con datos de prueba" | "integrado con API" | "publicado";

export type ModuleCode = "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7";

export type DataOrigin = "fixtures" | "api" | "csv" | "mixed";

export type DataFreshness = "fresh" | "cached" | "local" | "example";

export type ViewScenario =
  | "normal"
  | "vacio"
  | "pocos-datos"
  | "validacion"
  | "inviable"
  | "no-disponible"
  | "denegado"
  | "cargando";

export interface ProvenanceInfo {
  origin: DataOrigin;
  freshness: DataFreshness;
  isExample: boolean;
  calculatedAt: string;
  effectiveRange?: { from: string; to: string; observations: number };
  assumptions?: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export type AdapterResult<T> =
  | { status: "ok"; data: T; provenance: ProvenanceInfo }
  | { status: "empty"; title: string; message: string; actionLabel?: string; actionHref?: string }
  | {
      status: "insufficient_data";
      title: string;
      message: string;
      details?: string[];
      effectiveRange?: { from: string; to: string; observations: number; required: number };
    }
  | { status: "validation_error"; title: string; message: string; issues: ValidationIssue[] }
  | { status: "infeasible"; title: string; message: string; conflicts: string[] }
  | { status: "unavailable"; title: string; message: string; lastUpdated?: string | null }
  | { status: "forbidden"; title: string; message: string }
  | {
      status: "not_integrated";
      moduleCode: ModuleCode;
      moduleName: string;
      backendDependency: string;
      message: string;
    };

export interface ModuleRegistryItem {
  code: ModuleCode;
  slug: string;
  name: string;
  srsRefs: string;
  appHref: string;
  devHref: string;
  deliveryState: ModuleDeliveryState;
  backendDependency: string;
  summary: string;
  pendingFields: string[];
}

const VALID_SCENARIOS = new Set<ViewScenario>([
  "normal",
  "vacio",
  "pocos-datos",
  "validacion",
  "inviable",
  "no-disponible",
  "denegado",
  "cargando",
]);

export const SCENARIO_LABELS: Record<ViewScenario, string> = {
  normal: "Datos completos",
  vacio: "Lista vacía",
  "pocos-datos": "Datos insuficientes",
  validacion: "Error de validación",
  inviable: "Restricción inviable",
  "no-disponible": "Servicio no disponible",
  denegado: "Acceso denegado",
  cargando: "Cargando",
};

/**
 * Solo habilita vistas y adaptadores con datos sintéticos fuera de producción y cuando el
 * entorno local activa explícitamente `MARKOVLAB_USE_LOCAL_FIXTURES=1`.
 */
export function isLocalFixturesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" && env.MARKOVLAB_USE_LOCAL_FIXTURES === "1";
}

/** Mapea fallos transversales del backend (autenticación, configuración o disponibilidad). */
export function mapCommonBackendFailure<T>(
  error: unknown,
  unavailableTitle: string,
  unavailableMessage: string,
): AdapterResult<T> | null {
  const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : null;
  if (status === 401 || status === 403) {
    return {
      status: "forbidden",
      title: "Acceso no autorizado",
      message: "Tu sesión actual no tiene permisos o no pudo validarse en el servidor.",
    };
  }
  if (status === null || status === 0 || status === 503 || status >= 500) {
    return {
      status: "unavailable",
      title: unavailableTitle,
      message: unavailableMessage,
    };
  }
  return null;
}

export function parseScenario(raw?: string | string[] | null): ViewScenario {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && VALID_SCENARIOS.has(value as ViewScenario)) {
    return value as ViewScenario;
  }
  return "normal";
}

export const MODULE_REGISTRY: readonly ModuleRegistryItem[] = [
  {
    code: "F1",
    slug: "analisis",
    name: "Análisis de activos",
    srsRefs: "RF-15 a RF-20",
    appHref: "/app/mercado/analisis",
    devHref: "/dev/vistas/analisis",
    deliveryState: "integrado con API",
    backendDependency: "B2 · conectado (POST /api/internal/analysis/assets)",
    summary: "Rendimientos simples y logarítmicos, volatilidad, drawdown, matriz de correlación N×N y fechas efectivas.",
    pendingFields: [
      "POST /api/internal/analysis/assets conectado en asset-analysis.server.ts",
    ],
  },
  {
    code: "F2",
    slug: "cartera-editar",
    name: "Mercado y edición de carteras",
    srsRefs: "RF-13, RF-27 a RF-33",
    appHref: "/app/carteras",
    devHref: "/dev/vistas/cartera-editar",
    deliveryState: "integrado con API",
    backendDependency: "B1 y B3 · conectado (watchlist RF-13, PUT, versions, duplicate)",
    summary: "Etiquetas de origen/frescura en Mercado, edición de carteras con fecha de referencia, versiones y duplicación.",
    pendingFields: [
      "GET /api/internal/watchlist (latest_price_source, latest_price_status) conectado en /app/mercado",
      "PUT /api/internal/portfolios/{id}, GET .../versions y POST .../duplicate conectados en portfolio-edit.server.ts y actions.ts",
    ],
  },
  {
    code: "F3",
    slug: "estres",
    name: "Escenarios de estrés",
    srsRefs: "RF-46",
    appHref: "/app/carteras",
    devHref: "/dev/vistas/estres",
    deliveryState: "integrado con API",
    backendDependency: "B4 · conectado (POST /api/internal/portfolios/{id}/stress)",
    summary: "Comparación Base vs Estrés compartiendo horizonte, nivel de confianza y semilla reproducible.",
    pendingFields: [
      "POST /api/internal/portfolios/{id}/stress conectado en stress.server.ts",
    ],
  },
  {
    code: "F4",
    slug: "optimizacion",
    name: "Optimización de carteras",
    srsRefs: "RF-34 a RF-40",
    appHref: "/app/optimizacion",
    devHref: "/dev/vistas/optimizacion",
    deliveryState: "integrado con API",
    backendDependency: "B5 · conectado (POST y GET /api/internal/portfolios/{id}/optimizations)",
    summary: "Objetivos de mínima varianza y máximo Sharpe, cotas mín/máx por activo, tope de riesgo e historial.",
    pendingFields: [
      "POST y GET /api/internal/portfolios/{id}/optimizations conectados en optimization.server.ts y acciones",
    ],
  },
  {
    code: "F5",
    slug: "prediccion",
    name: "Predicción de activos",
    srsRefs: "RF-21 a RF-26",
    appHref: "/app/prediccion",
    devHref: "/dev/vistas/prediccion",
    deliveryState: "integrado con API",
    backendDependency: "B6 · conectado (POST /api/internal/assets/{id}/predictions y GET /api/internal/predictions/{id})",
    summary: "Pronóstico de rendimiento y volatilidad con bandas de incertidumbre, metadatos persistidos y contraste observado.",
    pendingFields: [
      "POST /api/internal/assets/{id}/predictions y GET /api/internal/predictions/{id} conectados en prediction.server.ts y acciones",
    ],
  },
  {
    code: "F6",
    slug: "backtesting",
    name: "Backtesting de estrategias",
    srsRefs: "RF-49 a RF-53",
    appHref: "/app/backtesting",
    devHref: "/dev/vistas/backtesting",
    deliveryState: "pantalla con datos de prueba",
    backendDependency: "B7 · pendiente de API",
    summary: "Evaluación histórica fuera de muestra separada de la configuración, benchmark opcional e historial guardado.",
    pendingFields: [
      "POST / GET /api/internal/backtests",
      "request: { strategy_id, config_from, config_to, eval_from, eval_to, rebalance, benchmark_symbol? }",
      "response: { run_id, assumptions, eval_metrics, benchmark_metrics?, curve_points[], history[] }",
      "error 400 overlapping_windows cuando config_to >= eval_from",
    ],
  },
  {
    code: "F7",
    slug: "reportes",
    name: "Dashboard y reportes",
    srsRefs: "RF-54 a RF-58",
    appHref: "/app/reportes",
    devHref: "/dev/vistas/reportes",
    deliveryState: "pantalla con datos de prueba",
    backendDependency: "B8 · pendiente de API",
    summary: "Resumen consolidado con fecha/período/fuente, glosario matemático inspeccionable y exportación CSV controlada.",
    pendingFields: [
      "GET /api/internal/reports/summary -> runs consolidados con source, freshness, period_from, period_to",
      "GET /api/internal/reports/{id}/export?format=csv (actor-scoped, descarga real solo cuando B8 responda)",
      "can_export_csv?: boolean para habilitar el botón únicamente en producción integrada",
    ],
  },
];

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
    deliveryState: "pantalla con datos de prueba",
    backendDependency: "B2 · pendiente de API",
    summary: "Rendimientos simples y logarítmicos, volatilidad, drawdown, matriz de correlación N×N y fechas efectivas.",
    pendingFields: [
      "GET /api/internal/assets/analysis o POST /api/internal/analysis/assets",
      "series_aligned, effective_from, effective_to, aligned_observations",
      "per_asset_metrics[].{simple_return,log_return,cumulative_return,mean_return,volatility_daily,volatility_annual,max_drawdown,peak_date,trough_date}",
      "correlation_matrix.symbols y correlation_matrix.values[][]",
      "error 422 insufficient_data con min_observations y missing_symbols",
    ],
  },
  {
    code: "F2",
    slug: "cartera-editar",
    name: "Mercado y edición de carteras",
    srsRefs: "RF-13, RF-27 a RF-33",
    appHref: "/app/carteras",
    devHref: "/dev/vistas/cartera-editar",
    deliveryState: "pantalla con datos de prueba",
    backendDependency: "B1 y B3 · pendiente de API",
    summary: "Etiquetas de origen/frescura en Mercado, edición de carteras con fecha de referencia, versiones y duplicación.",
    pendingFields: [
      "GET /api/internal/watchlist -> price_source ('api'|'csv'|null), data_freshness ('fresh'|'cached'|'local'|null), updated_at",
      "PATCH / PUT /api/internal/portfolios/{id} con start_date y positions[]",
      "POST /api/internal/portfolios/{id}/duplicate -> nueva cartera derivada_de_id sin alterar origen",
      "GET /api/internal/portfolios/{id}/versions -> lista de versiones con rendimiento/riesgo estimado",
    ],
  },
  {
    code: "F3",
    slug: "estres",
    name: "Escenarios de estrés",
    srsRefs: "RF-46",
    appHref: "/app/carteras",
    devHref: "/dev/vistas/estres",
    deliveryState: "pantalla con datos de prueba",
    backendDependency: "B4 · pendiente de API",
    summary: "Comparación Base vs Estrés compartiendo horizonte, nivel de confianza y semilla reproducible.",
    pendingFields: [
      "POST /api/internal/portfolios/{id}/stress",
      "request: { horizon, confidence, seed, shocks: { return_shift, volatility_multiplier, correlation_shift } }",
      "response: { baseline, stressed, deltas, effective_window, invariant_note }",
      "error 400 invalid_stress_params / 422 insufficient_data",
    ],
  },
  {
    code: "F4",
    slug: "optimizacion",
    name: "Optimización de carteras",
    srsRefs: "RF-34 a RF-40",
    appHref: "/app/optimizacion",
    devHref: "/dev/vistas/optimizacion",
    deliveryState: "pantalla con datos de prueba",
    backendDependency: "B5 · pendiente de API",
    summary: "Objetivos de mínima varianza y máximo Sharpe, cotas mín/máx por activo, tope de riesgo e inviabilidad.",
    pendingFields: [
      "POST /api/internal/portfolios/optimize",
      "request: { portfolio_id?, asset_ids[], objective ('min_variance'|'max_sharpe'), constraints[], max_volatility?, risk_free_rate? }",
      "response: { optimized_weights[], manual_weights[], metrics_manual, metrics_optimized, frequency, risk_free_rate }",
      "error 422 infeasible_constraints con conflicts[]",
    ],
  },
  {
    code: "F5",
    slug: "prediccion",
    name: "Predicción de activos",
    srsRefs: "RF-21 a RF-26",
    appHref: "/app/prediccion",
    devHref: "/dev/vistas/prediccion",
    deliveryState: "pantalla con datos de prueba",
    backendDependency: "B6 · pendiente de API",
    summary: "Pronóstico de rendimiento y volatilidad con bandas de incertidumbre, metadatos persistidos y contraste observado.",
    pendingFields: [
      "POST / GET /api/internal/forecasts",
      "request: { asset_id, metric ('return'|'volatility'), horizon_days, cutoff_date? }",
      "response: { model_name, model_params, training_window, calculated_at, limitations[], series[], evaluation_metrics? }",
      "distinción explícita de observations posterior vs forecast_band",
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

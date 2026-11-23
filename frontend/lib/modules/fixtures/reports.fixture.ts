import type { AdapterResult, ViewScenario } from "../runtime";
import type { DashboardOverviewData, MetricFormulaDoc, ReportsData } from "../types";

const FORMULAS: MetricFormulaDoc[] = [
  {
    id: "simple-log-return",
    name: "Rendimiento simple y logarítmico",
    unit: "%",
    formula: "R_t = P_t / P_{t-1} - 1   |   r_t = ln(P_t / P_{t-1})",
    interpretation: "El rendimiento simple es aditivo entre activos de una cartera; el logarítmico es aditivo en el tiempo.",
    assumptions: "Calculado sobre cierres ajustados cronológicos (PriceBar) sin huecos en fechas comunes.",
  },
  {
    id: "annualized-volatility",
    name: "Volatilidad diaria y anualizada",
    unit: "% anual",
    formula: "sigma_anual = sd(r_t) * sqrt(252)",
    interpretation: "Mide la dispersión de los rendimientos diarios escalada a un año bursátil estándar.",
    assumptions: "Convención de 252 días hábiles por año e independencia temporal aproximada.",
  },
  {
    id: "max-drawdown",
    name: "Drawdown máximo",
    unit: "%",
    formula: "MDD = min_t ( V_t / max_{s <= t} V_s - 1 )",
    interpretation: "Mayor retroceso porcentual desde un máximo histórico previo hasta su valle posterior.",
    assumptions: "Evaluado sobre cierres diarios dentro del período efectivo mostrado.",
  },
  {
    id: "pearson-corr",
    name: "Correlación de Pearson entre activos",
    unit: "adimensional [-1, +1]",
    formula: "rho(X, Y) = cov(r_X, r_Y) / (sd(r_X) * sd(r_Y))",
    interpretation: "Valores menores a +1 reducen la varianza agregada al combinar activos en una cartera.",
    assumptions: "Estimada únicamente sobre fechas de cierre compartidas entre ambos activos.",
  },
  {
    id: "var-cvar",
    name: "Valor en Riesgo (VaR) y CVaR",
    unit: "% y moneda",
    formula: "VaR_alpha = -q_{1-alpha}(R_sim)   |   CVaR_alpha = -E[R_sim | R_sim <= -VaR_alpha]",
    interpretation: "El VaR acota el umbral de pérdida al nivel de confianza; el CVaR promedia las pérdidas de la cola extrema.",
    assumptions: "Obtenido sobre 10,000 trayectorias normal-rebalanced-v1 con semilla fija reproducible.",
  },
  {
    id: "sharpe",
    name: "Ratio Sharpe",
    unit: "adimensional",
    formula: "Sharpe = (E[R_anual] - r_f) / sigma_anual",
    interpretation: "Exceso de rendimiento esperado por unidad de volatilidad asumida frente a la tasa libre de riesgo.",
    assumptions: "Usa r_f = 4.50 % anual y frecuencia homogénea entre numerador y denominador.",
  },
];

export function buildDashboardFixture(params: {
  userName?: string | null;
  scenario?: ViewScenario;
}): AdapterResult<DashboardOverviewData> {
  const scenario = params.scenario ?? "normal";

  if (scenario === "no-disponible") {
    return {
      status: "unavailable",
      title: "Resumen del laboratorio no disponible",
      message: "No pudimos consultar tus carteras ni tu lista de seguimiento. Recarga en unos momentos.",
      lastUpdated: "2026-10-30 16:25",
    };
  }
  if (scenario === "denegado") {
    return {
      status: "forbidden",
      title: "Sesión requerida",
      message: "Inicia sesión para consultar tu panel de carteras y análisis.",
    };
  }
  if (scenario === "vacio") {
    return {
      status: "empty",
      title: "Laboratorio sin carteras ni análisis guardados",
      message: "Crea tu primera cartera o agrega activos a Seguimiento de mercado para ver tu resumen consolidado.",
      actionLabel: "Ir a Análisis de activos",
      actionHref: "/dev/vistas/analisis",
    };
  }

  return {
    status: "ok",
    data: {
      userName: params.userName ?? "Investigación Académica",
      portfolioCount: 3,
      watchlistCount: 4,
      latestOriginSummary: "API y respaldo CSV (datos de ejemplo locales)",
      modules: [
        {
          code: "F2",
          name: "Mis carteras",
          srsRefs: "RF-27 a RF-33",
          href: "/app/carteras",
          deliveryState: "publicado",
          backendStatusLabel: "Publicado (edición/versiones pendientes B3)",
          description: "Crea carteras multiactivo, inspecciona su valor histórico y ejecuta simulaciones Monte Carlo.",
          available: true,
        },
        {
          code: "F2",
          name: "Seguimiento de mercado",
          srsRefs: "RF-08 a RF-13",
          href: "/dev/vistas/mercado",
          deliveryState: "publicado",
          backendStatusLabel: "Publicado (origen B1 pendiente)",
          description: "Monitorea cierres recientes, variaciones por período y estado de actualización.",
          available: true,
        },
        {
          code: "F1",
          name: "Análisis de activos",
          srsRefs: "RF-15 a RF-20",
          href: "/dev/vistas/analisis",
          deliveryState: "pantalla con datos de prueba",
          backendStatusLabel: "Pantalla con datos de prueba (B2)",
          description: "Rendimientos simples/logarítmicos, volatilidad, drawdown y matriz de correlación.",
          available: true,
        },
        {
          code: "F3",
          name: "Escenarios de estrés",
          srsRefs: "RF-46",
          href: "/dev/vistas/estres",
          deliveryState: "pantalla con datos de prueba",
          backendStatusLabel: "Pantalla con datos de prueba (B4)",
          description: "Compara Base vs Estrés compartiendo horizonte, confianza y semilla.",
          available: true,
        },
        {
          code: "F4",
          name: "Optimización de carteras",
          srsRefs: "RF-34 a RF-40",
          href: "/dev/vistas/optimizacion",
          deliveryState: "pantalla con datos de prueba",
          backendStatusLabel: "Pantalla con datos de prueba (B5)",
          description: "Mínima varianza, máximo Sharpe, límites por activo y detección de inviabilidad.",
          available: true,
        },
        {
          code: "F5",
          name: "Predicción de activos",
          srsRefs: "RF-21 a RF-26",
          href: "/dev/vistas/prediccion",
          deliveryState: "pantalla con datos de prueba",
          backendStatusLabel: "Pantalla con datos de prueba (B6)",
          description: "Pronósticos base con bandas de incertidumbre, limitaciones y contraste observado.",
          available: true,
        },
        {
          code: "F6",
          name: "Backtesting de estrategias",
          srsRefs: "RF-49 a RF-53",
          href: "/dev/vistas/backtesting",
          deliveryState: "pantalla con datos de prueba",
          backendStatusLabel: "Pantalla con datos de prueba (B7)",
          description: "Evaluación fuera de muestra separada de la configuración y comparación con benchmark.",
          available: true,
        },
        {
          code: "F7",
          name: "Reportes y detalle matemático",
          srsRefs: "RF-54 a RF-58",
          href: "/dev/vistas/reportes",
          deliveryState: "pantalla con datos de prueba",
          backendStatusLabel: "Pantalla con datos de prueba (B8)",
          description: "Resumen consolidado con origen, fórmulas documentadas y estado de exportación CSV.",
          available: true,
        },
      ],
      recentAnalyses: [
        {
          id: "rep-f1",
          moduleName: "Análisis de activos",
          title: "AAPL, MSFT, JPM, WALMEX.MX",
          periodLabel: "2025-11-03 a 2026-10-30",
          origin: "fixtures",
          freshness: "example",
          calculatedAt: "2026-10-30 16:10",
          headlineMetricLabel: "Retorno acumulado AAPL",
          headlineMetricValue: "+19.80 %",
          href: "/dev/vistas/analisis",
        },
        {
          id: "rep-f3",
          moduleName: "Escenario de estrés",
          title: "Núcleo Académico · Caída de mercado",
          periodLabel: "252 días · 95 % · semilla 42",
          origin: "fixtures",
          freshness: "example",
          calculatedAt: "2026-10-30 16:20",
          headlineMetricLabel: "VaR bajo estrés",
          headlineMetricValue: "102,500.00 MXN",
          href: "/dev/vistas/estres",
        },
        {
          id: "rep-f4",
          moduleName: "Optimización",
          title: "Máximo Sharpe con límites 5–45 %",
          periodLabel: "2025-11-03 a 2026-10-30",
          origin: "fixtures",
          freshness: "example",
          calculatedAt: "2026-10-30 16:25",
          headlineMetricLabel: "Sharpe optimizado",
          headlineMetricValue: "0.73",
          href: "/dev/vistas/optimizacion",
        },
        {
          id: "rep-f6",
          moduleName: "Backtesting",
          title: "Máximo Sharpe trimestral vs S&P 500",
          periodLabel: "OOS 2025-01-02 a 2026-10-30",
          origin: "fixtures",
          freshness: "example",
          calculatedAt: "2026-10-30 16:12",
          headlineMetricLabel: "Retorno OOS",
          headlineMetricValue: "+28.40 %",
          href: "/dev/vistas/backtesting",
        },
      ],
    },
    provenance: {
      origin: "fixtures",
      freshness: "example",
      isExample: true,
      calculatedAt: "2026-10-30 16:25",
      assumptions: "Vista consolidada de demostración local (sin conexión a B2–B8)",
    },
  };
}

export function buildReportsFixture(scenario: ViewScenario = "normal"): AdapterResult<ReportsData> {
  if (scenario === "vacio") {
    return {
      status: "empty",
      title: "Aún no hay reportes generados",
      message: "Ejecuta un análisis de activos, optimización, simulación o backtesting para incorporarlo al resumen consolidado.",
      actionLabel: "Ir a Análisis de activos",
      actionHref: "/app/mercado/analisis",
    };
  }
  if (scenario === "pocos-datos") {
    return {
      status: "insufficient_data",
      title: "Cobertura incompleta para generar el reporte consolidado",
      message: "Uno de los análisis incluidos carece de sesiones comunes suficientes en el período consultado.",
      details: ["Completa los cierres faltantes antes de exportar el resumen."],
    };
  }
  if (scenario === "validacion") {
    return {
      status: "validation_error",
      title: "Filtro de reportes inválido",
      message: "Selecciona un rango de fechas coherente para filtrar los análisis registrados.",
      issues: [{ field: "reports-filter", message: "El identificador de módulo seleccionado no es válido." }],
    };
  }
  if (scenario === "no-disponible") {
    return {
      status: "unavailable",
      title: "Servicio de reportes no disponible",
      message: "No fue posible consultar el resumen ni preparar la exportación en este momento.",
      lastUpdated: "2026-10-30 16:25",
    };
  }
  if (scenario === "denegado") {
    return {
      status: "forbidden",
      title: "Acceso restringido a los reportes",
      message: "Cada usuario únicamente puede consultar y exportar los análisis asociados a su cuenta.",
    };
  }

  return {
    status: "ok",
    data: {
      reports: [
        {
          id: "r1",
          moduleCode: "F1",
          title: "Matriz de correlación y riesgo de 4 activos",
          subject: "AAPL, MSFT, JPM, WALMEX.MX",
          periodFrom: "2025-11-03",
          periodTo: "2026-10-30",
          calculatedAt: "2026-10-30 16:10",
          origin: "fixtures",
          freshness: "example",
          frequency: "Diaria · 252 días/año",
          currency: "Multimoneda (MXN/USD)",
          primaryMetricLabel: "Retorno AAPL",
          primaryMetricValue: "+19.80 %",
          secondaryMetricLabel: "Vol. AAPL",
          secondaryMetricValue: "24.76 %",
        },
        {
          id: "r2",
          moduleCode: "F3",
          title: "Estrés comparativo Base vs Caída de mercado",
          subject: "Núcleo Académico · v3 (semilla 42)",
          periodFrom: "2025-11-03",
          periodTo: "2026-10-30",
          calculatedAt: "2026-10-30 16:20",
          origin: "fixtures",
          freshness: "example",
          frequency: "252 días hábiles · 95 %",
          currency: "MXN",
          primaryMetricLabel: "VaR bajo estrés",
          primaryMetricValue: "102,500.00 MXN",
          secondaryMetricLabel: "CVaR bajo estrés",
          secondaryMetricValue: "116,000.00 MXN",
        },
        {
          id: "r3",
          moduleCode: "F4",
          title: "Cartera optimizada Máximo Sharpe",
          subject: "Restricciones 5 % a 45 % por activo",
          periodFrom: "2025-11-03",
          periodTo: "2026-10-30",
          calculatedAt: "2026-10-30 16:25",
          origin: "fixtures",
          freshness: "example",
          frequency: "Diaria · rf = 4.50 %",
          currency: "MXN",
          primaryMetricLabel: "Sharpe optimizado",
          primaryMetricValue: "0.73",
          secondaryMetricLabel: "Vol. anualizada",
          secondaryMetricValue: "15.40 %",
        },
        {
          id: "r4",
          moduleCode: "F5",
          title: "Pronóstico base EWMA (AAPL 63 días)",
          subject: "Modelo ewma-drift-baseline-v1",
          periodFrom: "2026-02-02",
          periodTo: "2026-07-31",
          calculatedAt: "2026-07-31 16:30",
          origin: "fixtures",
          freshness: "example",
          frequency: "Horizonte 63 d · IC 80 %",
          currency: "USD",
          primaryMetricLabel: "MAE observado",
          primaryMetricValue: "1.10 %",
          secondaryMetricLabel: "Cobertura IC",
          secondaryMetricValue: "100.00 %",
        },
        {
          id: "r5",
          moduleCode: "F6",
          title: "Backtesting Máximo Sharpe trimestral",
          subject: "OOS vs S&P 500 (10 pb costo)",
          periodFrom: "2025-01-02",
          periodTo: "2026-10-30",
          calculatedAt: "2026-10-30 16:12",
          origin: "fixtures",
          freshness: "example",
          frequency: "Rebalanceo trimestral",
          currency: "USD",
          primaryMetricLabel: "Retorno OOS",
          primaryMetricValue: "+28.40 %",
          secondaryMetricLabel: "Drawdown máx.",
          secondaryMetricValue: "-9.80 %",
        },
      ],
      formulas: FORMULAS,
      exportCapabilities: {
        csvAvailable: false,
        reasonWhenUnavailable:
          "La exportación CSV real depende del endpoint B8 del backend (GET /api/internal/reports/{id}/export). No se generan descargas simuladas con datos de prueba.",
        expectedColumns: [
          "report_id",
          "module_code",
          "subject",
          "period_from",
          "period_to",
          "calculated_at",
          "data_origin",
          "freshness",
          "metric_name",
          "metric_value",
          "unit",
        ],
      },
    },
    provenance: {
      origin: "fixtures",
      freshness: "example",
      isExample: true,
      calculatedAt: "2026-10-30 16:25",
      assumptions: "Glosario matemático sincronizado con backend/src/domain/; exportación bloqueada hasta conectar B8",
    },
  };
}

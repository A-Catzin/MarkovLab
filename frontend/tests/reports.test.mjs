import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import {
  fetchReportCsvExport,
  loadDashboardOverview,
  loadReportsView,
} from "../lib/modules/adapters/reports.server.ts";
import { buildDashboardFixture, buildReportsFixture } from "../lib/modules/fixtures/reports.fixture.ts";

test("F7 nunca habilita descargas CSV simuladas sin API B8 conectada (RF-58)", () => {
  const res = buildReportsFixture("normal");
  assert.equal(res.status, "ok");
  assert.equal(res.data.exportCapabilities.csvAvailable, false);
  assert.ok(res.data.exportCapabilities.reasonWhenUnavailable.length > 10);
  assert.ok(res.data.exportCapabilities.expectedColumns.length >= 6);
});

test("F7 cada reporte declara fecha, período y origen; el glosario cubre métricas clave (RF-54, RF-56, RF-57)", () => {
  const res = buildReportsFixture("normal");
  assert.equal(res.status, "ok");
  assert.ok(res.data.reports.length >= 5);
  for (const row of res.data.reports) {
    assert.ok(row.periodFrom.length === 10 && row.periodTo.length === 10);
    assert.ok(row.calculatedAt.length >= 10);
    assert.ok(row.origin && row.freshness);
  }
  const formulaIds = new Set(res.data.formulas.map((f) => f.id));
  for (const key of ["simple-log-return", "annualized-volatility", "max-drawdown", "pearson-corr", "var-cvar", "sharpe"]) {
    assert.ok(formulaIds.has(key), `Falta fórmula ${key} en glosario`);
  }
});

test("F7 dashboard fixture cubre los módulos sin dejar Mis carteras como En construcción", () => {
  const dash = buildDashboardFixture({ userName: "Angel", scenario: "normal" });
  assert.equal(dash.status, "ok");
  const portfolios = dash.data.modules.find((m) => m.name.toLowerCase().includes("carteras"));
  assert.ok(portfolios);
  assert.notEqual(portfolios.backendStatusLabel, "En construcción");
});

test("F7 adaptador nunca expone fixtures en producción y cae en unavailable sin backend", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  const prevUrl = process.env.BACKEND_URL;
  const prevKey = process.env.INTERNAL_API_KEY;
  try {
    delete process.env.BACKEND_URL;
    delete process.env.INTERNAL_API_KEY;
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prodReports = await loadReportsView({ actorId: "1", scenario: "normal" });
    assert.equal(prodReports.status, "unavailable");

    const exportUnconf = await fetchReportCsvExport({
      actorId: "1",
      reportId: "backtest:00000000-0000-4000-8000-000000000001",
    });
    assert.equal(exportUnconf.ok, false);
    if (!exportUnconf.ok) {
      assert.equal(exportUnconf.status, 503);
      assert.equal(exportUnconf.code, "not_configured");
    }
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
    if (prevUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = prevUrl;
    if (prevKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = prevKey;
  }
});

test("F7 conecta con contrato HTTP B8 (summary, dashboard recentAnalyses y export CSV por actor)", async () => {
  const reportId = "backtest:00000000-0000-4000-8000-000000000003";
  let emptyMode = false;
  const seenHeaders = [];

  const server = http.createServer((req, res) => {
    seenHeaders.push({
      url: req.url,
      internalKey: req.headers["x-internal-key"],
      actorUserId: req.headers["x-actor-user-id"],
      actorId: req.headers["x-actor-id"],
    });

    if (req.url?.startsWith("/api/internal/reports/summary") && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "private, no-store");
      res.end(
        JSON.stringify({
          reports: emptyMode
            ? []
            : [
                {
                  id: reportId,
                  kind: "backtest",
                  module_code: "F6",
                  title: "Backtesting de cartera",
                  subject: "Cartera Global",
                  period_from: null,
                  period_to: null,
                  calculated_at: "2026-11-23T19:00:00Z",
                  origin: "api",
                  freshness: "unknown",
                  frequency: "daily_sessions",
                  currency: null,
                  source: {
                    storage: "postgresql",
                    price_method: "adjusted_close_or_close",
                    ingestion: null,
                  },
                  model: "fixed_target_rebalance_v1",
                  parameters: { strategy: "min_variance" },
                  metrics: [
                    { id: "cumulative_return", label: "Rendimiento acumulado", unit: "fraction", value: 0.145 },
                    { id: "sharpe_ratio", label: "Ratio de Sharpe", unit: "ratio", value: null },
                  ],
                },
                {
                  id: "prediction:00000000-0000-4000-8000-000000000004",
                  kind: "prediction",
                  module_code: "F5",
                  title: "Predicción de activo",
                  subject: "AAPL",
                  period_from: "2025-01-02",
                  period_to: "2025-10-15",
                  calculated_at: "2026-11-23T18:55:00Z",
                  origin: "api",
                  freshness: "unknown",
                  frequency: "daily_sessions",
                  currency: "USD",
                  source: {
                    storage: "postgresql",
                    price_method: "adjusted_close_or_close",
                    ingestion: null,
                  },
                  model: "empirical_stationary_v1",
                  parameters: { metric: "return", horizon_days: 21 },
                  metrics: [
                    { id: "point", label: "Predicción central", unit: "fraction", value: 0.0021 },
                    { id: "lower_bound", label: "Límite inferior", unit: "fraction", value: -0.025 },
                  ],
                },
              ],
          formulas: [
            {
              id: "cumulative_return",
              name: "Rendimiento acumulado",
              unit: "fraction",
              formula: "V_final/V_inicial−1",
              interpretation: "Variación total.",
              assumptions: "Neto de costes.",
            },
            {
              id: "sharpe_ratio",
              name: "Ratio de Sharpe",
              unit: "ratio",
              formula: "(μ_anual−r_f)/σ_anual",
              interpretation: "Exceso de retorno.",
              assumptions: "Nulo si volatilidad cero.",
            },
          ],
          export_capabilities: {
            csv_available: true,
            expected_columns: [
              "id",
              "kind",
              "title",
              "subject",
              "period_from",
              "period_to",
              "calculated_at",
              "currency",
              "model",
              "storage",
              "price_method",
              "metric_id",
              "metric_label",
              "unit",
              "value",
            ],
          },
          covered_kinds: ["simulation", "optimization", "prediction", "backtest"],
        }),
      );
      return;
    }

    if (req.url === "/api/internal/portfolios" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ portfolios: [] }));
      return;
    }

    if (req.url === "/api/internal/watchlist" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ assets: [] }));
      return;
    }

    if (req.url === `/api/internal/reports/${reportId}/export?format=csv` && req.method === "GET") {
      if (req.headers["x-actor-user-id"] !== "actor-a") {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "not_found", message: "report not found" }));
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="report.csv"');
      res.setHeader("Cache-Control", "private, no-store");
      res.end(
        'id,kind,title,subject,period_from,period_to,calculated_at,currency,model,storage,price_method,metric_id,metric_label,unit,value\r\n' +
          `"${reportId}","backtest","Backtesting de cartera","Cartera Global","","","2026-11-23T19:00:00Z","","fixed_target_rebalance_v1","postgresql","adjusted_close_or_close","cumulative_return","Rendimiento acumulado","fraction",0.145\r\n`,
      );
      return;
    }

    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "not_found", message: "not found" }));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  const prevUrl = process.env.BACKEND_URL;
  const prevKey = process.env.INTERNAL_API_KEY;

  try {
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "0";
    process.env.BACKEND_URL = baseUrl;
    process.env.INTERNAL_API_KEY = "test-secret";

    const view = await loadReportsView({ actorId: "actor-a" });
    assert.equal(view.status, "ok");
    if (view.status === "ok") {
      assert.equal(view.provenance.isExample, false);
      assert.equal(view.provenance.freshness, "unknown");
      assert.equal(view.data.reports.length, 2);
      assert.equal(view.data.reports[0].periodFrom, "—");
      assert.equal(view.data.reports[0].currency, "—");
      assert.equal(view.data.reports[0].secondaryMetricValue, "—");
      assert.equal(view.data.exportCapabilities.csvAvailable, true);
      assert.equal(view.data.formulas.length, 2);
    }

    const dash = await loadDashboardOverview({ actorId: "actor-a", userName: "Ana" });
    assert.equal(dash.status, "ok");
    if (dash.status === "ok") {
      assert.equal(dash.data.recentAnalyses.length, 2);
      assert.equal(
        dash.data.recentAnalyses[1].href,
        "/app/prediccion?prediccion=00000000-0000-4000-8000-000000000004",
      );
    }

    const exported = await fetchReportCsvExport({ actorId: "actor-a", reportId });
    assert.equal(exported.ok, true);
    if (exported.ok) {
      assert.ok(exported.contentType.includes("text/csv"));
      assert.ok(exported.csv.includes(reportId));
    }

    const lastCall = seenHeaders[seenHeaders.length - 1];
    assert.equal(lastCall.internalKey, "test-secret");
    assert.equal(lastCall.actorUserId, "actor-a");

    const otherUserExport = await fetchReportCsvExport({ actorId: "actor-b", reportId });
    assert.equal(otherUserExport.ok, false);
    if (!otherUserExport.ok) assert.equal(otherUserExport.status, 404);

    const invalidFmt = await fetchReportCsvExport({ actorId: "actor-a", reportId, format: "json" });
    assert.equal(invalidFmt.ok, false);
    if (!invalidFmt.ok) assert.equal(invalidFmt.status, 400);

    emptyMode = true;
    const emptyView = await loadReportsView({ actorId: "actor-a" });
    assert.equal(emptyView.status, "ok");
    if (emptyView.status === "ok") {
      assert.equal(emptyView.data.reports.length, 0);
      assert.equal(emptyView.data.formulas.length, 2);
    }
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
    if (prevUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = prevUrl;
    if (prevKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = prevKey;
    server.close();
  }
});

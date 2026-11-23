import assert from "node:assert/strict";
import test from "node:test";
import { loadDashboardOverview, loadReportsView } from "../lib/modules/adapters/reports.server.ts";
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

test("F7 adaptador de reportes devuelve not_integrated en producción", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  try {
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prodReports = await loadReportsView({ actorId: "1", scenario: "normal" });
    assert.equal(prodReports.status, "not_integrated");
    assert.equal(typeof loadDashboardOverview, "function");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
  }
});

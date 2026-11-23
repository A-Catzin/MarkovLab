import assert from "node:assert/strict";
import test from "node:test";
import { loadBacktestingView } from "../lib/modules/adapters/backtesting.server.ts";
import { buildBacktestingFixture } from "../lib/modules/fixtures/backtesting.fixture.ts";
import { validateBacktestWindows } from "../lib/modules/validators.ts";

test("F6 separa estrictamente ventana de configuración de evaluación fuera de muestra (RF-49 a RF-53)", () => {
  const res = buildBacktestingFixture({ scenario: "normal" });
  assert.equal(res.status, "ok");
  assert.ok(res.data.runs.length >= 2);
  for (const run of res.data.runs) {
    assert.ok(run.configFrom < run.configTo);
    assert.ok(run.configTo < run.evalFrom, `Fuga temporal detectada en ${run.id}`);
    assert.ok(run.evalFrom < run.evalTo);
    assert.ok(run.curve.some((p) => p.phase === "config"));
    assert.ok(run.curve.some((p) => p.phase === "evaluation"));
  }
});

test("F6 rechaza ventanas solapadas con validación explícita", () => {
  const issues = validateBacktestWindows({
    configFrom: "2023-01-02",
    configTo: "2025-03-01",
    evalFrom: "2025-01-02",
    evalTo: "2026-10-30",
  });
  assert.equal(issues.length, 1);
});

test("F6 adaptador devuelve not_integrated en producción", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  try {
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prod = await loadBacktestingView({ actorId: "1", scenario: "normal" });
    assert.equal(prod.status, "not_integrated");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
  }
});

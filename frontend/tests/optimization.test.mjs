import assert from "node:assert/strict";
import test from "node:test";
import { loadOptimizationView } from "../lib/modules/adapters/optimization.server.ts";
import { buildOptimizationFixture } from "../lib/modules/fixtures/optimization.fixture.ts";

test("F4 fixture de optimización suma 1 y respeta los límites por activo en ambos objetivos (RF-34 a RF-38)", () => {
  for (const objective of ["min_variance", "max_sharpe"]) {
    const res = buildOptimizationFixture({ objective, scenario: "normal" });
    assert.equal(res.status, "ok");
    const totalManual = res.data.weights.reduce((acc, w) => acc + w.manualWeight, 0);
    const totalOpt = res.data.weights.reduce((acc, w) => acc + w.optimizedWeight, 0);
    assert.ok(Math.abs(totalManual - 1) < 0.0001);
    assert.ok(Math.abs(totalOpt - 1) < 0.0001);
    for (const row of res.data.weights) {
      assert.ok(row.optimizedWeight >= row.minWeight - 1e-6);
      assert.ok(row.optimizedWeight <= row.maxWeight + 1e-6);
    }
  }
});

test("F4 detecta restricciones inviables con explicación explícita (RF-39)", () => {
  const infeasible = buildOptimizationFixture({
    objective: "max_sharpe",
    maxVolatilityCap: 0.08,
    scenario: "normal",
  });
  assert.equal(infeasible.status, "infeasible");
  assert.ok(infeasible.conflicts.length > 0);
});

test("F4 adaptador devuelve not_integrated en producción", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  try {
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prod = await loadOptimizationView({ actorId: "1", scenario: "normal" });
    assert.equal(prod.status, "not_integrated");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
  }
});

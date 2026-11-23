import assert from "node:assert/strict";
import test from "node:test";
import { loadAssetAnalysisView } from "../lib/modules/adapters/asset-analysis.server.ts";
import { buildAssetAnalysisFixture } from "../lib/modules/fixtures/asset-analysis.fixture.ts";

test("F1 fixture entrega matriz de correlación simétrica con diagonal 1", () => {
  const result = buildAssetAnalysisFixture({
    symbols: ["AAPL", "MSFT", "JPM", "WALMEX.MX"],
    period: "1A",
    returnKind: "simple",
    scenario: "normal",
  });
  assert.equal(result.status, "ok");
  const { correlationMatrix, correlationSymbols, metrics } = result.data;
  assert.equal(correlationMatrix.length, correlationSymbols.length);
  assert.equal(metrics.length, 4);

  for (let i = 0; i < correlationMatrix.length; i++) {
    assert.equal(correlationMatrix[i].length, correlationSymbols.length);
    assert.equal(correlationMatrix[i][i], 1);
    for (let j = 0; j < correlationMatrix.length; j++) {
      const value = correlationMatrix[i][j];
      assert.ok(value !== null && value >= -1 && value <= 1);
      assert.equal(value, correlationMatrix[j][i]);
    }
  }
});

test("F1 detecta histórico insuficiente al incluir NU o menos de 20 sesiones (RF-20)", () => {
  const result = buildAssetAnalysisFixture({
    symbols: ["AAPL", "NU"],
    period: "1A",
    returnKind: "simple",
    scenario: "normal",
  });
  assert.equal(result.status, "insufficient_data");
  assert.ok(result.effectiveRange);
  assert.ok(result.effectiveRange.observations < result.effectiveRange.required);
});

test("F1 rechaza fechas invertidas con validation_error", () => {
  const result = buildAssetAnalysisFixture({
    symbols: ["AAPL", "MSFT"],
    period: "custom",
    from: "2026-10-01",
    to: "2026-01-01",
    returnKind: "simple",
    scenario: "normal",
  });
  assert.equal(result.status, "validation_error");
  assert.ok(result.issues.length > 0);
});

test("F1 adaptador de servidor devuelve not_integrated en producción aun con datos sintéticos en disco", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  try {
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prodResult = await loadAssetAnalysisView({ actorId: "1", scenario: "normal" });
    assert.equal(prodResult.status, "not_integrated");

    process.env.NODE_ENV = "development";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "0";
    const offResult = await loadAssetAnalysisView({ actorId: "1", scenario: "normal" });
    assert.equal(offResult.status, "not_integrated");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
  }
});

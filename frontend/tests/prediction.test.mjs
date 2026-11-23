import assert from "node:assert/strict";
import test from "node:test";
import { loadPredictionView } from "../lib/modules/adapters/prediction.server.ts";
import { buildPredictionFixture } from "../lib/modules/fixtures/prediction.fixture.ts";

test("F5 cumple lower <= point <= upper, ventana sin fuga y metadatos completos (RF-21 a RF-26)", () => {
  for (const withObserved of [true, false]) {
    const res = buildPredictionFixture({
      symbol: "AAPL",
      metric: "return",
      horizonDays: 63,
      withObserved,
      scenario: "normal",
    });
    assert.equal(res.status, "ok");
    assert.ok(res.data.modelName.length > 0);
    assert.ok(res.data.limitations.length >= 2);

    const forecastPoints = res.data.series.filter((p) => p.phase === "forecast");
    assert.ok(forecastPoints.length >= 2);
    assert.ok(res.data.trainingWindow.to < forecastPoints[0].date);

    for (const p of forecastPoints) {
      assert.ok(p.lowerBound !== null && p.forecastPoint !== null && p.upperBound !== null);
      assert.ok(p.lowerBound <= p.forecastPoint && p.forecastPoint <= p.upperBound);
    }

    if (withObserved) {
      assert.equal(res.data.hasPostObservations, true);
      assert.ok(res.data.evaluation !== null);
    } else {
      assert.equal(res.data.hasPostObservations, false);
      assert.equal(res.data.evaluation, null);
    }
  }
});

test("F5 adaptador devuelve not_integrated en producción", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  try {
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prod = await loadPredictionView({ actorId: "1", scenario: "normal" });
    assert.equal(prod.status, "not_integrated");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
  }
});

import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import {
  executeAssetPrediction,
  loadPredictionView,
  refreshAssetPrediction,
} from "../lib/modules/adapters/prediction.server.ts";
import { buildPredictionFixture } from "../lib/modules/fixtures/prediction.fixture.ts";

function makePredictionPayload(overrides = {}) {
  return {
    id: "pred-uuid-1",
    asset_id: 1,
    symbol: "AAPL",
    market: "NASDAQ",
    calculated_at: "2026-11-23T18:00:00Z",
    as_of: "2025-10-15",
    metric: "return",
    horizon_days: 21,
    model: "empirical_stationary_v1",
    parameters: {
      confidence: 0.9,
      max_training_closes: 252,
      volatility_sessions: 21,
      sessions_per_year: 252,
    },
    training_window: {
      from: "2024-10-15",
      to: "2025-10-15",
      observations: 251,
    },
    point: 0.0012,
    lower_bound: -0.024,
    upper_bound: 0.026,
    limitations: [
      "Historical distributions can change. The forecast is not a guarantee.",
      "The band describes individual sessions, not cumulative performance.",
    ],
    series: [
      {
        date: "2025-10-14",
        phase: "historical",
        date_estimated: false,
        historical_value: 0.004,
        forecast_point: null,
        lower_bound: null,
        upper_bound: null,
        observed_after_value: null,
      },
      {
        date: "2025-10-15",
        phase: "historical",
        date_estimated: false,
        historical_value: 0.001,
        forecast_point: null,
        lower_bound: null,
        upper_bound: null,
        observed_after_value: null,
      },
      {
        date: "2025-10-16",
        phase: "forecast",
        date_estimated: false,
        historical_value: null,
        forecast_point: 0.0012,
        lower_bound: -0.024,
        upper_bound: 0.026,
        observed_after_value: 0.005,
      },
      {
        date: "2025-11-18",
        phase: "forecast",
        date_estimated: true,
        historical_value: null,
        forecast_point: 0.0012,
        lower_bound: -0.024,
        upper_bound: 0.026,
        observed_after_value: null,
      },
    ],
    evaluation: {
      observed_points: 1,
      mae: 0.0038,
      rmse: 0.0038,
      interval_coverage: 1,
    },
    ...overrides,
  };
}

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

test("F5 adaptador nunca expone fixtures en producción y cae en unavailable sin backend", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  const prevUrl = process.env.BACKEND_URL;
  const prevKey = process.env.INTERNAL_API_KEY;
  try {
    delete process.env.BACKEND_URL;
    delete process.env.INTERNAL_API_KEY;
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prod = await loadPredictionView({ actorId: "1", scenario: "normal" });
    assert.equal(prod.status, "unavailable");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
    if (prevUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = prevUrl;
    if (prevKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = prevKey;
  }
});

test("F5 conecta con contrato HTTP B6 (POST assets/{id}/predictions, GET predictions/{id} y errores)", async () => {
  const calls = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const body = rawBody ? JSON.parse(rawBody) : null;
      calls.push({ method: req.method, url: req.url, body });
      res.setHeader("Content-Type", "application/json");

      if (req.url === "/api/internal/assets" && req.method === "GET") {
        res.end(
          JSON.stringify({
            assets: [
              {
                id: 1,
                symbol: "AAPL",
                name: "Apple Inc.",
                market: "NASDAQ",
                category: "Acciones",
                currency: "USD",
                price_rows: 300,
                first_date: "2024-01-02",
                last_date: "2025-11-17",
              },
              {
                id: 2,
                symbol: "SHORT",
                name: "Short History",
                market: "BMV",
                category: "Acciones",
                currency: "MXN",
                price_rows: 20,
                first_date: "2025-10-01",
                last_date: "2025-11-01",
              },
            ],
          }),
        );
        return;
      }

      if (req.url === "/api/internal/assets/1/predictions" && req.method === "POST") {
        if (body.as_of === "2099-01-01") {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "invalid_input", message: "as_of cannot be later than the latest stored close" }));
          return;
        }
        res.statusCode = 201;
        res.end(
          JSON.stringify(
            makePredictionPayload({
              metric: body.metric,
              horizon_days: body.horizon_days,
              as_of: body.as_of ?? "2025-11-17",
            }),
          ),
        );
        return;
      }

      if (req.url === "/api/internal/assets/2/predictions" && req.method === "POST") {
        res.statusCode = 422;
        res.end(JSON.stringify({ error: "insufficient_data", message: "need at least 60 closes" }));
        return;
      }

      if (req.url === "/api/internal/predictions/pred-uuid-1" && req.method === "GET") {
        res.end(JSON.stringify(makePredictionPayload()));
        return;
      }

      if (req.url === "/api/internal/predictions/pred-missing" && req.method === "GET") {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "not_found", message: "prediction not found" }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not_found", message: "not found" }));
    });
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

    const initial = await loadPredictionView({ actorId: "7" });
    assert.equal(initial.status, "ok");
    assert.equal(initial.provenance.isExample, false);
    assert.equal(initial.data.series.length, 0);
    assert.equal(initial.data.activePredictionId, null);
    assert.equal(calls.filter((c) => c.method === "POST").length, 0);

    const created = await executeAssetPrediction({
      actorId: "7",
      assetId: 1,
      metric: "return",
      horizonDays: 21,
      asOf: "2025-10-15",
    });
    assert.equal(created.ok, true);
    if (created.ok) {
      assert.equal(created.prediction.activePredictionId, "pred-uuid-1");
      assert.equal(created.prediction.asOf, "2025-10-15");
      assert.equal(created.prediction.confidenceLabel, "IC 90 %");
      assert.equal(created.prediction.hasPostObservations, true);
      assert.equal(created.prediction.evaluation?.observedPoints, 1);
      assert.equal(created.prediction.series[3].dateEstimated, true);
    }

    const refreshed = await refreshAssetPrediction({ actorId: "7", predictionId: "pred-uuid-1" });
    assert.equal(refreshed.ok, true);

    const reloaded = await loadPredictionView({ actorId: "7", predictionId: "pred-uuid-1" });
    assert.equal(reloaded.status, "ok");
    if (reloaded.status === "ok") {
      assert.equal(reloaded.data.activePredictionId, "pred-uuid-1");
      assert.equal(reloaded.data.series.length, 4);
    }

    const shortErr = await executeAssetPrediction({
      actorId: "7",
      assetId: 2,
      metric: "volatility",
      horizonDays: 63,
    });
    assert.equal(shortErr.ok, false);
    if (!shortErr.ok) {
      assert.equal(shortErr.kind, "insufficient_data");
    }

    const badDateErr = await executeAssetPrediction({
      actorId: "7",
      assetId: 1,
      metric: "return",
      horizonDays: 21,
      asOf: "2099-01-01",
    });
    assert.equal(badDateErr.ok, false);
    if (!badDateErr.ok) {
      assert.equal(badDateErr.kind, "validation");
    }

    const missingReload = await loadPredictionView({ actorId: "7", predictionId: "pred-missing" });
    assert.equal(missingReload.status, "ok");
    if (missingReload.status === "ok") {
      assert.equal(missingReload.data.activePredictionId, null);
      assert.ok(missingReload.data.predictionLoadError);
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

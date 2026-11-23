import assert from "node:assert/strict";
import http from "node:http";
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

test("F1 adaptador nunca expone fixtures en producción y cae en unavailable sin backend", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  const prevUrl = process.env.BACKEND_URL;
  const prevKey = process.env.INTERNAL_API_KEY;
  try {
    delete process.env.BACKEND_URL;
    delete process.env.INTERNAL_API_KEY;

    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prodResult = await loadAssetAnalysisView({ actorId: "1", scenario: "normal" });
    assert.equal(prodResult.status, "unavailable");

    process.env.NODE_ENV = "development";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "0";
    const offResult = await loadAssetAnalysisView({ actorId: "1", scenario: "normal" });
    assert.equal(offResult.status, "unavailable");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
    if (prevUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = prevUrl;
    if (prevKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = prevKey;
  }
});

test("F1 conecta con contrato HTTP de B2 (/api/internal/analysis/assets) y distingue 422", async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const body = rawBody ? JSON.parse(rawBody) : null;
      requests.push({ method: req.method, url: req.url, body, headers: req.headers });
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/api/internal/assets") {
        res.end(
          JSON.stringify({
            assets: [
              { id: 1, symbol: "AAPL", name: "Apple", market: "NASDAQ", category: "Acción", currency: "USD", price_rows: 100, first_date: "2024-01-02", last_date: "2024-06-07" },
              { id: 2, symbol: "SHORT", name: "Short", market: "NASDAQ", category: "Acción", currency: "USD", price_rows: 1, first_date: "2024-06-07", last_date: "2024-06-07" },
            ],
          }),
        );
        return;
      }
      if (req.url === "/api/internal/analysis/assets") {
        if (body.symbols.includes("SHORT")) {
          res.statusCode = 422;
          res.end(
            JSON.stringify({
              error: "insufficient_data",
              message: "the requested window has fewer than two common close sessions",
              required_sessions: 2,
              observed_sessions: 1,
            }),
          );
          return;
        }
        res.end(
          JSON.stringify({
            selected_symbols: body.symbols,
            period_preset: body.period,
            return_kind: body.return_kind,
            requested_from: "2024-06-03",
            requested_to: "2024-06-07",
            effective_from: "2024-06-03",
            effective_to: "2024-06-07",
            aligned_observations: 3,
            annualization_factor: 252,
            per_asset_metrics: [
              {
                asset_id: 1,
                symbol: "AAPL",
                name: "Apple",
                currency: "USD",
                observations: 3,
                effective_from: "2024-06-03",
                effective_to: "2024-06-07",
                simple_return: 0.05,
                log_return: 0.04879,
                cumulative_return: 0.05,
                mean_return_daily: 0.025,
                volatility_daily: 0.012,
                volatility_annualized: 0.19,
                max_drawdown: -0.02,
                peak_date: "2024-06-05",
                trough_date: "2024-06-07",
              },
            ],
            series_aligned: [
              { symbol: "AAPL", points: [["2024-06-03", 100], ["2024-06-05", 107], ["2024-06-07", 105]] },
            ],
            correlation_symbols: ["AAPL"],
            correlation_matrix: [[1]],
          }),
        );
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  const prevUrl = process.env.BACKEND_URL;
  const prevKey = process.env.INTERNAL_API_KEY;

  try {
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "0";
    process.env.BACKEND_URL = `http://127.0.0.1:${addr.port}`;
    process.env.INTERNAL_API_KEY = "k".repeat(32);

    const ok = await loadAssetAnalysisView({ actorId: "actor-1", period: "1A", returnKind: "simple" });
    assert.equal(ok.status, "ok");
    assert.equal(ok.provenance.isExample, false);
    assert.equal(ok.data.selectedSymbols[0], "AAPL");
    const postReq = requests.find((r) => r.url === "/api/internal/analysis/assets");
    assert.ok(postReq);
    assert.equal(postReq.body.from, undefined);
    assert.equal(postReq.body.to, undefined);
    assert.equal(postReq.headers["x-actor-id"], "actor-1");

    const short = await loadAssetAnalysisView({
      actorId: "actor-1",
      symbols: ["AAPL", "SHORT"],
      period: "custom",
      from: "2024-06-03",
      to: "2024-06-07",
    });
    assert.equal(short.status, "insufficient_data");
    assert.equal(short.effectiveRange?.required, 2);
    assert.equal(short.effectiveRange?.observations, 1);
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
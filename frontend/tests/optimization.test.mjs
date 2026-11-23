import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import {
  executePortfolioOptimization,
  loadOptimizationView,
} from "../lib/modules/adapters/optimization.server.ts";
import { buildOptimizationFixture } from "../lib/modules/fixtures/optimization.fixture.ts";

function makeRun(id, objective, overrides = {}) {
  return {
    id,
    created_at: "2026-11-23T12:00:00Z",
    portfolio_id: "pf-b5",
    portfolio_version: 2,
    portfolio_name: "Núcleo B5",
    capital: 1000,
    currency: "USD",
    start_date: "2024-01-02",
    objective,
    objective_value: objective === "min_variance" ? 0.04 : 0.72,
    return_model: "daily_simple_arithmetic_v1",
    periods_per_year: 252,
    risk_free_rate: 0.02,
    lookback_years: 5,
    max_volatility: null,
    feasible_min_volatility: 0.145,
    window: { from: "2024-01-02", to: "2024-04-02" },
    observations: 64,
    weights: [
      {
        asset_id: 1,
        symbol: "AAA",
        name: "AAA Corp",
        market: "NYSE",
        asset_currency: "USD",
        manual_weight: 0.6,
        optimized_weight: 0.75,
        min_weight: 0.2,
        max_weight: 0.85,
      },
      {
        asset_id: 2,
        symbol: "BBB",
        name: "BBB ETF",
        market: "NYSE",
        asset_currency: "USD",
        manual_weight: 0.4,
        optimized_weight: 0.25,
        min_weight: 0.15,
        max_weight: 0.8,
      },
    ],
    manual_stats: { expected_annual_return: 0.11, annualized_volatility: 0.22, sharpe_ratio: 0.41 },
    optimized_stats: { expected_annual_return: 0.12, annualized_volatility: 0.16, sharpe_ratio: 0.625 },
    solver: "HiGHS",
    solver_wrapper_version: "1.27.0",
    ...overrides,
  };
}

test("F4 fixture de optimización suma 1 y respeta los límites por activo en ambos objetivos (RF-34 a RF-38)", () => {
  for (const objective of ["min_variance", "max_sharpe"]) {
    const res = buildOptimizationFixture({ objective, scenario: "normal" });
    assert.equal(res.status, "ok");
    assert.ok(res.data.manualStats);
    assert.ok(res.data.optimizedStats);
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

test("F4 adaptador nunca expone fixtures en producción y cae en unavailable sin backend", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  const prevUrl = process.env.BACKEND_URL;
  const prevKey = process.env.INTERNAL_API_KEY;
  try {
    delete process.env.BACKEND_URL;
    delete process.env.INTERNAL_API_KEY;
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prod = await loadOptimizationView({ actorId: "1", scenario: "normal" });
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

test("F4 conecta con contrato HTTP B5 (GET/POST optimizations, tope inviable con mínimo alcanzable y errores)", async () => {
  const savedRuns = [];
  const calls = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const body = rawBody ? JSON.parse(rawBody) : null;
      calls.push({ method: req.method, url: req.url, body });
      res.setHeader("Content-Type", "application/json");

      if (req.url === "/api/internal/portfolios" && req.method === "GET") {
        res.end(
          JSON.stringify({
            portfolios: [
              {
                id: "pf-b5",
                name: "Núcleo B5",
                capital: 1000,
                currency: "USD",
                start_date: "2024-01-02",
                status: "draft",
                created_at: "2024-01-02T00:00:00Z",
                positions: [
                  { asset_id: 1, symbol: "AAA", market: "NYSE", name: "AAA Corp", weight: 0.6, currency: "USD" },
                  { asset_id: 2, symbol: "BBB", market: "NYSE", name: "BBB ETF", weight: 0.4, currency: "USD" },
                ],
              },
            ],
          }),
        );
        return;
      }

      if (req.url === "/api/internal/portfolios/pf-b5/optimizations" && req.method === "GET") {
        res.end(JSON.stringify({ optimizations: savedRuns }));
        return;
      }

      if (req.url === "/api/internal/portfolios/pf-b5/optimizations" && req.method === "POST") {
        if (body.max_volatility !== undefined && body.max_volatility < 0.145) {
          res.statusCode = 422;
          res.end(
            JSON.stringify({
              error: "optimization_infeasible",
              message: "no portfolio satisfies the optimization constraints",
              details: { reason: "volatility_cap_below_minimum", minimum_volatility: 0.145 },
            }),
          );
          return;
        }
        const sumMin = (body.bounds ?? []).reduce((acc, b) => acc + b.min_weight, 0);
        if (sumMin > 1.000001) {
          res.statusCode = 422;
          res.end(
            JSON.stringify({
              error: "optimization_infeasible",
              message: "no portfolio satisfies the optimization constraints",
              details: { reason: "minimum_weights_exceed_one", minimum_volatility: null },
            }),
          );
          return;
        }
        const created = makeRun(`run-${savedRuns.length + 1}`, body.objective, {
          max_volatility: body.max_volatility ?? null,
          risk_free_rate: body.risk_free_rate ?? 0,
          lookback_years: body.lookback_years ?? 5,
          optimized_stats:
            body.objective === "max_sharpe"
              ? { expected_annual_return: 0.14, annualized_volatility: 0.18, sharpe_ratio: null }
              : { expected_annual_return: 0.12, annualized_volatility: 0.145, sharpe_ratio: 0.6897 },
        });
        savedRuns.unshift(created);
        res.statusCode = 201;
        res.end(JSON.stringify(created));
        return;
      }

      if (req.url === "/api/internal/portfolios/pf-short/optimizations" && req.method === "POST") {
        res.statusCode = 422;
        res.end(JSON.stringify({ error: "insufficient_data", message: "need at least 60 common sessions" }));
        return;
      }

      if (req.url === "/api/internal/portfolios/pf-zero/optimizations" && req.method === "POST") {
        res.statusCode = 422;
        res.end(JSON.stringify({ error: "undefined_sharpe", message: "Sharpe cannot be calculated" }));
        return;
      }

      if (req.url === "/api/internal/portfolios/pf-solver/optimizations" && req.method === "POST") {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: "optimization_unavailable", message: "the solver could not certify" }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not_found", message: "not found" }));
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
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    process.env.BACKEND_URL = `http://127.0.0.1:${addr.port}`;
    process.env.INTERNAL_API_KEY = "k".repeat(32);

    const initial = await loadOptimizationView({ actorId: "ana" });
    assert.equal(initial.status, "ok");
    assert.equal(initial.provenance.isExample, false);
    assert.equal(initial.data.history?.length, 0);
    assert.equal(initial.data.activeRun, null);
    assert.equal(calls.filter((c) => c.method === "POST").length, 0);

    const infeasible = await executePortfolioOptimization({
      actorId: "ana",
      portfolioId: "pf-b5",
      objective: "max_sharpe",
      bounds: [
        { assetId: 1, minWeight: 0.2, maxWeight: 0.85 },
        { assetId: 2, minWeight: 0.15, maxWeight: 0.8 },
      ],
      maxVolatility: 0.08,
    });
    assert.equal(infeasible.ok, false);
    assert.equal(infeasible.kind, "infeasible");
    assert.equal(infeasible.reason, "volatility_cap_below_minimum");
    assert.equal(infeasible.minimumVolatility, 0.145);
    assert.ok(infeasible.conflicts?.some((line) => line.includes("14.50 %")));

    const minExceeds = await executePortfolioOptimization({
      actorId: "ana",
      portfolioId: "pf-b5",
      objective: "min_variance",
      bounds: [
        { assetId: 1, minWeight: 0.6, maxWeight: 0.9 },
        { assetId: 2, minWeight: 0.5, maxWeight: 0.9 },
      ],
    });
    assert.equal(minExceeds.ok, false);
    assert.equal(minExceeds.kind, "infeasible");
    assert.equal(minExceeds.reason, "minimum_weights_exceed_one");

    const okMin = await executePortfolioOptimization({
      actorId: "ana",
      portfolioId: "pf-b5",
      objective: "min_variance",
      bounds: [
        { assetId: 1, minWeight: 0.2, maxWeight: 0.85 },
        { assetId: 2, minWeight: 0.15, maxWeight: 0.8 },
      ],
      riskFreeRate: 0.02,
      lookbackYears: 5,
    });
    assert.equal(okMin.ok, true);
    assert.equal(okMin.run.objective, "min_variance");

    const okSharpe = await executePortfolioOptimization({
      actorId: "ana",
      portfolioId: "pf-b5",
      objective: "max_sharpe",
      bounds: [],
      maxVolatility: 0.2,
    });
    assert.equal(okSharpe.ok, true);
    assert.equal(okSharpe.run.optimizedStats.sharpeRatio, null);

    const after = await loadOptimizationView({ actorId: "ana" });
    assert.equal(after.status, "ok");
    assert.equal(after.data.history?.length, 2);
    assert.equal(after.data.activeRun?.id, okSharpe.run.id);

    const short = await executePortfolioOptimization({
      actorId: "ana",
      portfolioId: "pf-short",
      objective: "min_variance",
      bounds: [],
    });
    assert.equal(short.ok, false);
    assert.equal(short.kind, "insufficient_data");

    const zeroSharpe = await executePortfolioOptimization({
      actorId: "ana",
      portfolioId: "pf-zero",
      objective: "max_sharpe",
      bounds: [],
    });
    assert.equal(zeroSharpe.ok, false);
    assert.equal(zeroSharpe.kind, "undefined_sharpe");

    const solverErr = await executePortfolioOptimization({
      actorId: "ana",
      portfolioId: "pf-solver",
      objective: "min_variance",
      bounds: [],
    });
    assert.equal(solverErr.ok, false);
    assert.equal(solverErr.kind, "unavailable");
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
import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import {
  executePortfolioBacktest,
  loadBacktestingView,
} from "../lib/modules/adapters/backtesting.server.ts";
import { buildBacktestingFixture } from "../lib/modules/fixtures/backtesting.fixture.ts";
import { validateBacktestWindows } from "../lib/modules/validators.ts";

function makeBacktestRun(id, body, overrides = {}) {
  return {
    id,
    portfolio_id: "pf-b7",
    portfolio_version: 2,
    portfolio_name: "Cartera B7",
    currency: "USD",
    executed_at: "2026-11-23T18:15:00Z",
    model: "fixed_target_rebalance_v1",
    strategy: body.strategy,
    config_from: body.config_from,
    config_to: body.config_to,
    eval_from: body.eval_from,
    eval_to: body.eval_to,
    rebalance: body.rebalance ?? "none",
    transaction_cost_bps: body.transaction_cost_bps ?? 0,
    risk_free_rate: body.risk_free_rate ?? 0,
    configuration: { from: body.config_from, to: body.config_to, observations: 250 },
    evaluation: { from: body.eval_from, to: body.eval_to, observations: 125 },
    weights: [
      { asset_id: 1, symbol: "AAPL", market: "NASDAQ", manual_weight: 0.6, target_weight: 0.52 },
      { asset_id: 2, symbol: "MSFT", market: "NASDAQ", manual_weight: 0.4, target_weight: 0.48 },
    ],
    benchmark:
      body.benchmark_id === 17
        ? { asset_id: 17, symbol: "SPY", market: "NYSE", currency: "USD" }
        : null,
    strategy_metrics: {
      cumulative_return: 0.145,
      annualized_return: 0.121,
      annualized_volatility: 0.16,
      max_drawdown: -0.072,
      sharpe_ratio: body.strategy === "manual" ? null : 0.631,
    },
    benchmark_metrics:
      body.benchmark_id === 17
        ? {
            cumulative_return: 0.11,
            annualized_return: 0.092,
            annualized_volatility: 0.15,
            max_drawdown: -0.085,
            sharpe_ratio: 0.48,
          }
        : null,
    curve: [
      { date: body.config_from, phase: "config", strategy_index: 99.9, benchmark_index: null },
      { date: body.config_to, phase: "config", strategy_index: 112.4, benchmark_index: null },
      {
        date: body.eval_from,
        phase: "evaluation",
        strategy_index: 99.9,
        benchmark_index: body.benchmark_id === 17 ? 100.0 : null,
      },
      {
        date: body.eval_to,
        phase: "evaluation",
        strategy_index: 114.5,
        benchmark_index: body.benchmark_id === 17 ? 111.0 : null,
      },
    ],
    ...overrides,
  };
}

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

test("F6 adaptador nunca expone fixtures en producción y cae en unavailable sin backend", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  const prevUrl = process.env.BACKEND_URL;
  const prevKey = process.env.INTERNAL_API_KEY;
  try {
    delete process.env.BACKEND_URL;
    delete process.env.INTERNAL_API_KEY;
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prod = await loadBacktestingView({ actorId: "1", scenario: "normal" });
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

test("F6 conecta con contrato HTTP B7 (GET/POST backtests, benchmark opcional, sharpe null y errores)", async () => {
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
                id: "pf-b7",
                name: "Cartera B7",
                capital: 10000,
                currency: "USD",
                start_date: "2024-01-02",
                status: "active",
                created_at: "2024-01-02T00:00:00Z",
                positions: [
                  { asset_id: 1, symbol: "AAPL", market: "NASDAQ", name: "Apple Inc.", weight: 0.6, currency: "USD" },
                  { asset_id: 2, symbol: "MSFT", market: "NASDAQ", name: "Microsoft Corp.", weight: 0.4, currency: "USD" },
                ],
              },
            ],
          }),
        );
        return;
      }

      if (req.url === "/api/internal/assets" && req.method === "GET") {
        res.end(
          JSON.stringify({
            assets: [
              {
                id: 17,
                symbol: "SPY",
                name: "SPDR S&P 500 ETF",
                market: "NYSE",
                category: "ETF",
                currency: "USD",
                price_rows: 500,
                first_date: "2022-01-03",
                last_date: "2025-12-31",
              },
            ],
          }),
        );
        return;
      }

      if (req.url === "/api/internal/portfolios/pf-b7/backtests" && req.method === "GET") {
        res.end(JSON.stringify({ backtests: savedRuns }));
        return;
      }

      if (req.url === "/api/internal/portfolios/pf-b7/backtests" && req.method === "POST") {
        if (body.benchmark_id === 999) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "not_found", message: "benchmark asset not found" }));
          return;
        }
        const created = makeBacktestRun(`bt-run-${savedRuns.length + 1}`, body);
        savedRuns.unshift(created);
        res.statusCode = 201;
        res.end(JSON.stringify(created));
        return;
      }

      if (req.url === "/api/internal/portfolios/pf-short/backtests" && req.method === "POST") {
        res.statusCode = 422;
        res.end(JSON.stringify({ error: "insufficient_data", message: "need more common sessions" }));
        return;
      }

      if (req.url === "/api/internal/portfolios/pf-zero/backtests" && req.method === "POST") {
        res.statusCode = 422;
        res.end(JSON.stringify({ error: "undefined_sharpe", message: "zero variance" }));
        return;
      }

      if (req.url === "/api/internal/portfolios/pf-infeas/backtests" && req.method === "POST") {
        res.statusCode = 422;
        res.end(JSON.stringify({ error: "optimization_infeasible", message: "infeasible" }));
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

    const initial = await loadBacktestingView({ actorId: "7" });
    assert.equal(initial.status, "ok");
    if (initial.status === "ok") {
      assert.equal(initial.data.runs.length, 0);
      assert.equal(initial.data.activeRunId, null);
      assert.equal(initial.provenance.isExample, false);
    }
    assert.equal(calls.filter((c) => c.method === "POST").length, 0);

    const withBench = await executePortfolioBacktest({
      actorId: "7",
      portfolioId: "pf-b7",
      strategy: "min_variance",
      configFrom: "2024-01-02",
      configTo: "2024-12-31",
      evalFrom: "2025-01-02",
      evalTo: "2025-12-31",
      rebalance: "quarterly",
      transactionCostBps: 10,
      riskFreeRate: 0.02,
      benchmarkId: 17,
    });
    assert.equal(withBench.ok, true);
    if (withBench.ok) {
      assert.equal(withBench.run.benchmarkSymbol, "SPY");
      assert.ok(withBench.run.benchmarkMetrics !== null);
      assert.equal(withBench.run.weights?.length, 2);
      assert.equal(withBench.run.portfolioVersion, 2);
    }

    const noBench = await executePortfolioBacktest({
      actorId: "7",
      portfolioId: "pf-b7",
      strategy: "manual",
      configFrom: "2024-01-02",
      configTo: "2024-12-31",
      evalFrom: "2025-01-02",
      evalTo: "2025-12-31",
      rebalance: "none",
      transactionCostBps: 0,
      riskFreeRate: 0,
      benchmarkId: null,
    });
    assert.equal(noBench.ok, true);
    if (noBench.ok) {
      assert.equal(noBench.run.benchmarkSymbol, null);
      assert.equal(noBench.run.benchmarkMetrics, null);
      assert.equal(noBench.run.strategyMetrics.sharpeRatio, null);
    }

    const postNoBench = calls.findLast((c) => c.method === "POST");
    assert.equal("benchmark_id" in postNoBench.body, false);

    const overlapErr = await executePortfolioBacktest({
      actorId: "7",
      portfolioId: "pf-b7",
      strategy: "min_variance",
      configFrom: "2024-01-02",
      configTo: "2025-02-01",
      evalFrom: "2025-01-15",
      evalTo: "2025-12-31",
    });
    assert.equal(overlapErr.ok, false);
    if (!overlapErr.ok) {
      assert.equal(overlapErr.kind, "validation");
    }

    const shortErr = await executePortfolioBacktest({
      actorId: "7",
      portfolioId: "pf-short",
      strategy: "min_variance",
      configFrom: "2024-01-02",
      configTo: "2024-12-31",
      evalFrom: "2025-01-02",
      evalTo: "2025-12-31",
    });
    assert.equal(shortErr.ok, false);
    if (!shortErr.ok) assert.equal(shortErr.kind, "insufficient_data");

    const sharpeErr = await executePortfolioBacktest({
      actorId: "7",
      portfolioId: "pf-zero",
      strategy: "max_sharpe",
      configFrom: "2024-01-02",
      configTo: "2024-12-31",
      evalFrom: "2025-01-02",
      evalTo: "2025-12-31",
    });
    assert.equal(sharpeErr.ok, false);
    if (!sharpeErr.ok) assert.equal(sharpeErr.kind, "undefined_sharpe");

    const missingBench = await executePortfolioBacktest({
      actorId: "7",
      portfolioId: "pf-b7",
      strategy: "manual",
      configFrom: "2024-01-02",
      configTo: "2024-12-31",
      evalFrom: "2025-01-02",
      evalTo: "2025-12-31",
      benchmarkId: 999,
    });
    assert.equal(missingBench.ok, false);
    if (!missingBench.ok) assert.equal(missingBench.kind, "not_found");
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

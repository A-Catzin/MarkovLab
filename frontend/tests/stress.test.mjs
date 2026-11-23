import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { loadStressTestingView } from "../lib/modules/adapters/stress.server.ts";
import { buildStressTestingFixture } from "../lib/modules/fixtures/stress.fixture.ts";
import { validateStressParams } from "../lib/modules/validators.ts";

test("F3 compara Base vs Estrés compartiendo horizonte, confianza y semilla exactos (RF-46)", () => {
  const result = buildStressTestingFixture({ portfolioId: "pf-v3", presetId: "caida-mercado", scenario: "normal" });
  assert.equal(result.status, "ok");
  const { baseline, stressedByPreset, presets } = result.data;
  for (const preset of presets) {
    const stressed = stressedByPreset[preset.presetId];
    assert.ok(stressed);
    assert.equal(stressed.horizonDays, baseline.horizonDays);
    assert.equal(stressed.confidence, baseline.confidence);
    assert.equal(stressed.seed, baseline.seed);
    assert.ok(stressed.varAmount >= baseline.varAmount);
    assert.ok(stressed.cvarAmount >= baseline.cvarAmount);
  }
});

test("F3 rechaza choques fuera de dominio matemático", () => {
  assert.equal(validateStressParams({ returnShift: -1.0, volatilityMultiplier: 1.5, correlationShift: 0 }).length, 1);
  assert.equal(validateStressParams({ returnShift: -0.1, volatilityMultiplier: -0.5, correlationShift: 0 }).length, 1);
  assert.equal(validateStressParams({ returnShift: -0.1, volatilityMultiplier: 1.2, correlationShift: 1.2 }).length, 1);
});

test("F3 adaptador nunca expone fixtures en producción y cae en unavailable sin backend", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  const prevUrl = process.env.BACKEND_URL;
  const prevKey = process.env.INTERNAL_API_KEY;
  try {
    delete process.env.BACKEND_URL;
    delete process.env.INTERNAL_API_KEY;
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prod = await loadStressTestingView({ actorId: "1", portfolioId: "1", scenario: "normal" });
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

test("F3 conecta con contrato HTTP de B4 (/api/internal/portfolios/{id}/stress)", async () => {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/api/internal/portfolios/pf-short/stress") {
        res.statusCode = 422;
        res.end(JSON.stringify({ error: "insufficient_data", message: "need 60 sessions" }));
        return;
      }
      if (req.url === "/api/internal/portfolios/pf-1/stress") {
        const penalty = Math.max(0, -body.return_shift * 200 + (body.volatility_multiplier - 1) * 50);
        res.end(
          JSON.stringify({
            portfolio_id: "pf-1",
            portfolio_name: "Escenario B4",
            capital: 1000,
            currency: "USD",
            model: "normal-rebalanced-v1",
            window: { from: "2024-01-02", to: "2024-06-07" },
            observations: 65,
            lookback_years: 5,
            shock: {
              return_shift: body.return_shift,
              volatility_multiplier: body.volatility_multiplier,
              correlation_shift: body.correlation_shift,
            },
            baseline: {
              horizon_days: body.horizon,
              confidence: body.confidence,
              seed: body.seed ?? 42,
              simulations: body.simulations,
              expected_final_value: 1020,
              median_final_value: 1018,
              p5_final_value: 950,
              p95_final_value: 1090,
              var_fraction: 0.05,
              var_amount: 50,
              cvar_fraction: 0.065,
              cvar_amount: 65,
            },
            stressed: {
              horizon_days: body.horizon,
              confidence: body.confidence,
              seed: body.seed ?? 42,
              simulations: body.simulations,
              expected_final_value: 1020 - penalty,
              median_final_value: 1018 - penalty,
              p5_final_value: 950 - penalty,
              p95_final_value: 1090,
              var_fraction: 0.05 + penalty / 1000,
              var_amount: 50 + penalty,
              cvar_fraction: 0.065 + penalty / 1000,
              cvar_amount: 65 + penalty,
            },
          }),
        );
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
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "0";
    process.env.BACKEND_URL = `http://127.0.0.1:${addr.port}`;
    process.env.INTERNAL_API_KEY = "k".repeat(32);

    const res = await loadStressTestingView({
      actorId: "actor-1",
      portfolioId: "pf-1",
      presetId: "personalizado",
      returnShift: -0.2,
      volatilityMultiplier: 1.8,
      correlationShift: 0.3,
    });
    assert.equal(res.status, "ok");
    assert.equal(res.provenance.isExample, false);
    assert.equal(res.data.activePresetId, "personalizado");
    assert.ok(res.data.stressedByPreset.personalizado.varAmount > res.data.baseline.varAmount);

    const short = await loadStressTestingView({ actorId: "actor-1", portfolioId: "pf-short" });
    assert.equal(short.status, "insufficient_data");
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
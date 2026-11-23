import assert from "node:assert/strict";
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

test("F3 adaptador devuelve not_integrated en producción", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  try {
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prod = await loadStressTestingView({ actorId: "1", portfolioId: "1", scenario: "normal" });
    assert.equal(prod.status, "not_integrated");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
  }
});

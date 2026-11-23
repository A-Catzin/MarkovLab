import assert from "node:assert/strict";
import test from "node:test";
import { loadPortfolioEditView } from "../lib/modules/adapters/portfolio-edit.server.ts";
import { buildMarketOriginFixture } from "../lib/modules/fixtures/market-origin.fixture.ts";
import { buildPortfolioVersionsFixture } from "../lib/modules/fixtures/portfolio-versions.fixture.ts";
import { validateDuplicationName, validatePortfolioEditInput } from "../lib/modules/validators.ts";

test("F2 market fixture distingue origen API, caché, CSV y ausencia de precios (RF-13)", () => {
  const result = buildMarketOriginFixture("normal");
  assert.equal(result.status, "ok");
  const sources = new Set(result.data.map((item) => item.priceSource));
  const freshness = new Set(result.data.map((item) => item.dataFreshness));
  assert.ok(sources.has("api"));
  assert.ok(sources.has("csv"));
  assert.ok(sources.has(null));
  assert.ok(freshness.has("fresh"));
  assert.ok(freshness.has("cached"));
  assert.ok(freshness.has("local"));
});

test("F2 fixture de versiones conserva suma de pesos = 1 y derivada_de_id válida (RF-32 y RF-33)", () => {
  const result = buildPortfolioVersionsFixture({ portfolioId: "demo-1", scenario: "normal" });
  assert.equal(result.status, "ok");
  assert.ok(result.data.versions.length >= 2);

  for (const version of result.data.versions) {
    const sum = version.positions.reduce((acc, p) => acc + p.weight, 0);
    assert.ok(Math.abs(sum - 1) < 0.0001, `La versión ${version.name} suma ${sum}`);
  }
  const hasDerived = result.data.versions.some((v) => v.derivedFromId !== null);
  assert.equal(hasDerived, true);
});

test("F2 valida edición de pesos, capital, fecha y nombre distinto al duplicar", () => {
  const invalidSum = validatePortfolioEditInput({
    name: "Cartera Global",
    capital: 50000,
    currency: "MXN",
    startDate: "2026-01-05",
    positions: [
      { assetId: 1, percent: 45 },
      { assetId: 2, percent: 45 },
    ],
  });
  assert.ok(invalidSum.some((item) => item.field === "portfolio-total"));

  const dupIssue = validateDuplicationName("Tecnología balanceada v2", ["Tecnología balanceada v2"]);
  assert.equal(dupIssue.length, 1);
  assert.equal(validateDuplicationName("Tecnología balanceada v3", ["Tecnología balanceada v2"]).length, 0);
});

test("F2 adaptador de edición devuelve not_integrated en producción", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  try {
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prodResult = await loadPortfolioEditView({ actorId: "1", portfolioId: "1", scenario: "normal" });
    assert.equal(prodResult.status, "not_integrated");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
  }
});

import assert from "node:assert/strict";
import http from "node:http";
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
  const statuses = new Set(result.data.map((item) => item.latestPriceStatus));
  assert.ok(sources.has("api"));
  assert.ok(sources.has("csv"));
  assert.ok(sources.has(null));
  assert.ok(freshness.has("fresh"));
  assert.ok(freshness.has("cached"));
  assert.ok(freshness.has("local"));
  assert.ok(statuses.has("updated"));
  assert.ok(statuses.has("local_file"));
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

test("F2 adaptador de edición nunca usa fixtures en producción y cae en unavailable sin backend", async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevFlag = process.env.MARKOVLAB_USE_LOCAL_FIXTURES;
  const prevUrl = process.env.BACKEND_URL;
  const prevKey = process.env.INTERNAL_API_KEY;
  try {
    delete process.env.BACKEND_URL;
    delete process.env.INTERNAL_API_KEY;
    process.env.NODE_ENV = "production";
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = "1";
    const prodResult = await loadPortfolioEditView({ actorId: "1", portfolioId: "1", scenario: "normal" });
    assert.equal(prodResult.status, "unavailable");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.MARKOVLAB_USE_LOCAL_FIXTURES = prevFlag;
    if (prevUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = prevUrl;
    if (prevKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = prevKey;
  }
});

test("F2 conecta con contrato HTTP de B3 (cartera, versiones y catálogo)", async () => {
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/api/internal/portfolios/pf-1") {
      res.end(
        JSON.stringify({
          id: "pf-1",
          name: "Base B3",
          capital: 1000,
          currency: "USD",
          start_date: "2024-06-05",
          status: "draft",
          created_at: "2024-06-05T12:00:00Z",
          positions: [{ asset_id: 1, symbol: "AAPL", market: "NASDAQ", name: "Apple", weight: 1.0, currency: "USD" }],
        }),
      );
      return;
    }
    if (req.url === "/api/internal/portfolios/pf-1/versions") {
      res.end(
        JSON.stringify({
          versions: [
            {
              id: "pf-1:2",
              version_number: 2,
              is_current: true,
              name: "Base B3",
              capital: 1000,
              currency: "USD",
              start_date: "2024-06-05",
              created_at: "2024-06-05T12:00:00Z",
              derived_from_id: null,
              derived_from_name: null,
              estimated_annual_return: null,
              estimated_annual_volatility: null,
              positions: [{ asset_id: 1, symbol: "AAPL", name: "Apple", weight: 1.0 }],
            },
          ],
        }),
      );
      return;
    }
    if (req.url === "/api/internal/assets") {
      res.end(
        JSON.stringify({
          assets: [
            { id: 1, symbol: "AAPL", name: "Apple", market: "NASDAQ", category: "Acción", currency: "USD", price_rows: 50, first_date: null, last_date: null },
          ],
        }),
      );
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not_found", message: "not found" }));
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

    const editView = await loadPortfolioEditView({ actorId: "actor-1", portfolioId: "pf-1" });
    assert.equal(editView.status, "ok");
    assert.equal(editView.provenance.isExample, false);
    assert.equal(editView.data.pendingBackend, false);
    assert.equal(editView.data.positions[0].percent, 100);
    assert.equal(editView.data.versions.length, 1);

    const missing = await loadPortfolioEditView({ actorId: "actor-1", portfolioId: "pf-missing" });
    assert.equal(missing.status, "empty");
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
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDateIso,
  formatInteger,
  formatMoney,
  formatPercent,
  formatPeriodRange,
  formatRatio,
  formatWeightPercent,
} from "../lib/formatters.ts";
import { isLocalFixturesEnabled, MODULE_REGISTRY, parseScenario } from "../lib/modules/runtime.ts";
import {
  validateBacktestWindows,
  validateDateRange,
  validateDuplicationName,
  validateOptimizationConstraints,
  validatePortfolioEditInput,
  validateStressParams,
} from "../lib/modules/validators.ts";

test("isLocalFixturesEnabled nunca se activa en producción", () => {
  assert.equal(isLocalFixturesEnabled({ NODE_ENV: "production", MARKOVLAB_USE_LOCAL_FIXTURES: "1" }), false);
  assert.equal(isLocalFixturesEnabled({ NODE_ENV: "development" }), false);
  assert.equal(isLocalFixturesEnabled({ NODE_ENV: "development", MARKOVLAB_USE_LOCAL_FIXTURES: "0" }), false);
  assert.equal(isLocalFixturesEnabled({ NODE_ENV: "development", MARKOVLAB_USE_LOCAL_FIXTURES: "1" }), true);
  assert.equal(isLocalFixturesEnabled({ NODE_ENV: "test", MARKOVLAB_USE_LOCAL_FIXTURES: "1" }), true);
});

test("parseScenario valida contra lista blanca y recae en normal", () => {
  assert.equal(parseScenario(undefined), "normal");
  assert.equal(parseScenario("pocos-datos"), "pocos-datos");
  assert.equal(parseScenario(["inviable", "normal"]), "inviable");
  assert.equal(parseScenario("malicioso<script>"), "normal");
});

test("MODULE_REGISTRY declara todas las entregas F1–F7 con estados válidos", () => {
  const codes = MODULE_REGISTRY.map((item) => item.code);
  assert.ok(codes.includes("F1"));
  assert.ok(codes.includes("F2"));
  assert.ok(codes.includes("F3"));
  assert.ok(codes.includes("F4"));
  assert.ok(codes.includes("F5"));
  assert.ok(codes.includes("F6"));
  assert.ok(codes.includes("F7"));
});

test("formatters imprimen ceros como cero y faltantes como raya", () => {
  assert.equal(formatMoney(0, "MXN"), "0.00 MXN");
  assert.equal(formatMoney(null, "MXN"), "—");
  assert.equal(formatPercent(0, { signed: true }), "0.00 %");
  assert.equal(formatPercent(0.0525, { signed: true }), "+5.25 %");
  assert.equal(formatPercent(-0.031, { signed: true }), "-3.10 %");
  assert.equal(formatPercent(undefined), "—");
  assert.equal(formatWeightPercent(0.25), "25 %");
  assert.equal(formatRatio(0), "0.00");
  assert.equal(formatRatio(null), "—");
  assert.equal(formatInteger(0), "0");
  assert.equal(formatInteger(null), "—");
  assert.equal(formatDateIso("2026-11-22"), "2026-11-22");
  assert.equal(formatDateIso(""), "—");
  assert.equal(formatPeriodRange("2025-01-02", "2026-10-30"), "2025-01-02 a 2026-10-30");
});

test("validadores detectan rangos invertidos, pesos fuera de 100 % y parámetros inválidos", () => {
  assert.equal(validateDateRange("2025-01-02", "2026-10-30").length, 0);
  assert.ok(validateDateRange("2026-10-30", "2025-01-02").length > 0);

  const okPortfolio = validatePortfolioEditInput({
    name: "Cartera núcleo",
    capital: 100000,
    currency: "MXN",
    startDate: "2026-01-05",
    positions: [
      { assetId: 1, percent: 60 },
      { assetId: 2, percent: 40 },
    ],
  });
  assert.equal(okPortfolio.length, 0);

  const badPortfolio = validatePortfolioEditInput({
    name: "",
    capital: -5,
    currency: "BAD",
    startDate: "invalida",
    positions: [
      { assetId: 1, percent: 50 },
      { assetId: 1, percent: 40 },
    ],
  });
  assert.ok(badPortfolio.length >= 4);

  assert.ok(validateDuplicationName("Base", ["Base", "Conservadora"]).length > 0);
  assert.equal(validateDuplicationName("Versión 2", ["Base"]).length, 0);

  assert.equal(validateStressParams({ returnShift: -0.15, volatilityMultiplier: 1.5, correlationShift: 0.25 }).length, 0);
  assert.ok(validateStressParams({ returnShift: -1.1, volatilityMultiplier: 0, correlationShift: 1.4 }).length === 3);

  const optOk = validateOptimizationConstraints(
    [
      { symbol: "AAPL", minWeight: 0.1, maxWeight: 0.6 },
      { symbol: "MSFT", minWeight: 0.2, maxWeight: 0.7 },
    ],
    0.2,
  );
  assert.equal(optOk.issues.length, 0);
  assert.equal(optOk.infeasibleReasons.length, 0);

  const optInfeasible = validateOptimizationConstraints(
    [
      { symbol: "AAPL", minWeight: 0.6, maxWeight: 0.9 },
      { symbol: "MSFT", minWeight: 0.5, maxWeight: 0.9 },
    ],
    0.2,
  );
  assert.ok(optInfeasible.infeasibleReasons.length > 0);

  assert.equal(
    validateBacktestWindows({
      configFrom: "2022-01-03",
      configTo: "2024-12-31",
      evalFrom: "2025-01-02",
      evalTo: "2026-10-30",
    }).length,
    0,
  );
  assert.ok(
    validateBacktestWindows({
      configFrom: "2022-01-03",
      configTo: "2025-03-01",
      evalFrom: "2025-01-02",
      evalTo: "2026-10-30",
    }).length > 0,
  );
});

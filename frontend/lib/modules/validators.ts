import type { ValidationIssue } from "./runtime";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES = new Set(["MXN", "USD", "EUR"]);

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

export function validateDateRange(
  from: string,
  to: string,
  options: { fromField?: string; toField?: string } = {},
): ValidationIssue[] {
  const fromField = options.fromField ?? "date-from";
  const toField = options.toField ?? "date-to";
  const issues: ValidationIssue[] = [];

  if (!isValidIsoDate(from)) {
    issues.push({ field: fromField, message: "Indica una fecha de inicio válida (AAAA-MM-DD)." });
  }
  if (!isValidIsoDate(to)) {
    issues.push({ field: toField, message: "Indica una fecha de fin válida (AAAA-MM-DD)." });
  }
  if (issues.length === 0 && from >= to) {
    issues.push({
      field: toField,
      message: "La fecha de fin debe ser posterior a la fecha de inicio.",
    });
  }
  return issues;
}

export function validatePortfolioEditInput(input: {
  name: string;
  capital: number;
  currency: string;
  startDate: string;
  positions: { assetId: number; percent: number }[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const trimmedName = input.name.trim();

  if (!trimmedName || trimmedName.length > 120) {
    issues.push({ field: "portfolio-name", message: "Escribe un nombre entre 1 y 120 caracteres." });
  }
  if (!Number.isFinite(input.capital) || input.capital < 0.01) {
    issues.push({ field: "portfolio-capital", message: "El capital inicial debe ser de al menos 0.01." });
  }
  if (!CURRENCIES.has(input.currency)) {
    issues.push({ field: "portfolio-currency", message: "La moneda debe ser MXN, USD o EUR." });
  }
  if (!isValidIsoDate(input.startDate)) {
    issues.push({ field: "portfolio-start-date", message: "Indica una fecha de referencia válida (AAAA-MM-DD)." });
  }
  if (input.positions.length === 0) {
    issues.push({ field: "portfolio-positions", message: "Agrega al menos un activo a la cartera." });
  }

  const seenAssets = new Set<number>();
  let total = 0;
  for (const row of input.positions) {
    if (!Number.isInteger(row.assetId) || row.assetId <= 0) {
      issues.push({ field: "portfolio-positions", message: "Selecciona un activo válido en cada fila." });
      break;
    }
    if (seenAssets.has(row.assetId)) {
      issues.push({ field: "portfolio-positions", message: "Cada activo solo puede aparecer una vez en la cartera." });
      break;
    }
    seenAssets.add(row.assetId);

    if (!Number.isFinite(row.percent) || row.percent <= 0 || row.percent > 100) {
      issues.push({
        field: "portfolio-positions",
        message: "Cada porcentaje debe estar entre 0.01 % y 100 %.",
      });
      break;
    }
    total += row.percent;
  }

  if (input.positions.length > 0 && Math.abs(total - 100) >= 0.005) {
    issues.push({
      field: "portfolio-total",
      message: `La suma actual es ${total.toFixed(2)} % y debe ser exactamente 100 %.`,
    });
  }

  return issues;
}

export function validateDuplicationName(name: string, existingNames: string[]): ValidationIssue[] {
  const clean = name.trim();
  if (!clean) {
    return [{ field: "duplicate-name", message: "Escribe un nombre para la copia de la cartera." }];
  }
  if (clean.length > 120) {
    return [{ field: "duplicate-name", message: "El nombre no puede superar 120 caracteres." }];
  }
  if (existingNames.some((item) => item.trim().toLowerCase() === clean.toLowerCase())) {
    return [
      {
        field: "duplicate-name",
        message: "Usa un nombre distinto al de las versiones existentes para distinguir la copia.",
      },
    ];
  }
  return [];
}

export function validateStressParams(input: {
  returnShift: number;
  volatilityMultiplier: number;
  correlationShift: number;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!Number.isFinite(input.returnShift) || input.returnShift <= -1 || input.returnShift > 1) {
    issues.push({
      field: "stress-return-shift",
      message: "El choque de rendimiento anual debe ser mayor a -100 % y menor o igual a +100 %.",
    });
  }
  if (!Number.isFinite(input.volatilityMultiplier) || input.volatilityMultiplier <= 0 || input.volatilityMultiplier > 5) {
    issues.push({
      field: "stress-vol-mult",
      message: "El multiplicador de volatilidad debe ser mayor a 0 y no superar 5.0×.",
    });
  }
  if (!Number.isFinite(input.correlationShift) || input.correlationShift < -1 || input.correlationShift > 1) {
    issues.push({
      field: "stress-corr-shift",
      message: "El ajuste de correlación debe mantenerse entre -1.00 y +1.00.",
    });
  }

  return issues;
}

export function validateOptimizationConstraints(
  constraints: { symbol: string; minWeight: number; maxWeight: number }[],
  maxVolatilityCap: number | null,
  feasibleMinVolatility = 0.114,
): { issues: ValidationIssue[]; infeasibleReasons: string[] } {
  const issues: ValidationIssue[] = [];
  const infeasibleReasons: string[] = [];

  let sumMin = 0;
  let sumMax = 0;

  for (const row of constraints) {
    if (!Number.isFinite(row.minWeight) || !Number.isFinite(row.maxWeight)) {
      issues.push({ field: `opt-min-${row.symbol}`, message: `Revisa los límites numéricos de ${row.symbol}.` });
      continue;
    }
    if (row.minWeight < 0 || row.maxWeight > 1) {
      issues.push({
        field: `opt-min-${row.symbol}`,
        message: `Los límites de ${row.symbol} deben estar entre 0 % y 100 %.`,
      });
    }
    if (row.minWeight > row.maxWeight) {
      infeasibleReasons.push(
        `En ${row.symbol}, el mínimo (${(row.minWeight * 100).toFixed(1)} %) supera al máximo (${(row.maxWeight * 100).toFixed(1)} %).`,
      );
    }
    sumMin += row.minWeight;
    sumMax += row.maxWeight;
  }

  if (maxVolatilityCap !== null && (!Number.isFinite(maxVolatilityCap) || maxVolatilityCap <= 0 || maxVolatilityCap > 2)) {
    issues.push({
      field: "opt-max-vol",
      message: "El tope de volatilidad anualizada debe ser mayor a 0 % y menor a 200 %.",
    });
  }

  if (issues.length === 0) {
    if (sumMin > 1.0001) {
      infeasibleReasons.push(
        `La suma de pesos mínimos (${(sumMin * 100).toFixed(1)} %) supera el 100 % disponible.`,
      );
    }
    if (sumMax < 0.9999) {
      infeasibleReasons.push(
        `La suma de pesos máximos (${(sumMax * 100).toFixed(1)} %) no alcanza el 100 % requerido.`,
      );
    }
    if (maxVolatilityCap !== null && maxVolatilityCap < feasibleMinVolatility) {
      infeasibleReasons.push(
        `El tope de riesgo (${(maxVolatilityCap * 100).toFixed(2)} %) es menor a la volatilidad mínima alcanzable (${(feasibleMinVolatility * 100).toFixed(2)} %).`,
      );
    }
  }

  return { issues, infeasibleReasons };
}

export function validateBacktestWindows(input: {
  configFrom: string;
  configTo: string;
  evalFrom: string;
  evalTo: string;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [
    ...validateDateRange(input.configFrom, input.configTo, {
      fromField: "bt-config-from",
      toField: "bt-config-to",
    }),
    ...validateDateRange(input.evalFrom, input.evalTo, {
      fromField: "bt-eval-from",
      toField: "bt-eval-to",
    }),
  ];

  if (issues.length === 0 && input.configTo >= input.evalFrom) {
    issues.push({
      field: "bt-eval-from",
      message:
        "El período de evaluación fuera de muestra debe comenzar estrictamente después de que termine el período de configuración.",
    });
  }

  return issues;
}

/**
 * Formateadores client-safe para cifras financieras, porcentajes, razones y fechas.
 * Invariante visual: los ceros reales se imprimen como cero; los valores faltantes o no
 * finitos se muestran como "—" (raya larga) y nunca con "--" de carga.
 */

export function formatMoney(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const normalized = Object.is(value, -0) ? 0 : value;
  const formatted = normalized.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

export function formatPercent(
  fraction: number | null | undefined,
  options: { decimals?: number; signed?: boolean } = {},
): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return "—";
  const decimals = options.decimals ?? 2;
  const signed = options.signed ?? false;
  const normalized = Object.is(fraction, -0) || Math.abs(fraction) < 1e-10 ? 0 : fraction;
  const pct = normalized * 100;
  const absFormatted = Math.abs(pct).toLocaleString("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (normalized < 0) return `-${absFormatted} %`;
  if (signed && normalized > 0) return `+${absFormatted} %`;
  return `${absFormatted} %`;
}

export function formatWeightPercent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return "—";
  const normalized = Object.is(fraction, -0) ? 0 : fraction;
  return `${(normalized * 100).toLocaleString("es-MX", { maximumFractionDigits: 2 })} %`;
}

export function formatRatio(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const normalized = Object.is(value, -0) || Math.abs(value) < 1e-10 ? 0 : value;
  return normalized.toLocaleString("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  return (Object.is(rounded, -0) ? 0 : rounded).toLocaleString("es-MX");
}

export function formatDateIso(dateIso: string | null | undefined): string {
  if (!dateIso || !dateIso.trim()) return "—";
  return dateIso.trim();
}

export function formatPeriodRange(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return "—";
  return `${from} a ${to}`;
}

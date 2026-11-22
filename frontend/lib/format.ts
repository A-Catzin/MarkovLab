/** Formatos comunes de la aplicación. Convención de México: coma para miles y punto para decimales. */

export function formatMoney(value: number, currency = "MXN"): string {
  return value.toLocaleString("es-MX", { style: "currency", currency, maximumFractionDigits: 0 });
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toLocaleString("es-MX", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`;
}

export function formatWeight(value: number): string {
  return `${value.toLocaleString("es-MX", { maximumFractionDigits: 1 })} %`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

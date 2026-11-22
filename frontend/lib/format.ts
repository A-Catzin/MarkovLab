/**
 * Formatos de fecha comunes de la aplicación. Los formatos de dinero y
 * porcentajes viven en `lib/portfolios.ts`, que es la única fuente de verdad
 * para cifras financieras.
 */

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

import "server-only";
import { BackendError, backendFetch, type BackendUser } from "./backend";

/**
 * Datos de las páginas de admin, leídos del backend con el id del admin que navega
 * (`X-Actor-Id`). El backend responde 403 si ese usuario ya no es admin.
 */

export type ImportStatus = "success" | "partial" | "failed";

export interface AdminSummary {
  users: number;
  admins: number;
  assets: number;
  price_rows: number;
  last_import: { status: ImportStatus; asset_symbol: string | null; saved: number; failed: number; started_at: string | null } | null;
}

export interface AdminAsset {
  id: number;
  symbol: string;
  name: string;
  market: string;
  category: string;
  currency: string;
  last_synced_at: string | null;
  price_rows: number;
  first_date: string | null;
  last_date: string | null;
}

export interface AdminImport {
  id: number;
  source: string;
  status: ImportStatus;
  asset_symbol: string | null;
  asset_market: string | null;
  saved: number;
  failed: number;
  message: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export const getAdminSummary = (actorId: string) => backendFetch<AdminSummary>("/api/internal/admin/summary", { actorId });

export const getAdminAssets = async (actorId: string) =>
  (await backendFetch<{ assets: AdminAsset[] }>("/api/internal/admin/assets", { actorId })).assets;

export const getAdminImports = async (actorId: string, limit = 100) =>
  (await backendFetch<{ imports: AdminImport[] }>(`/api/internal/admin/imports?limit=${limit}`, { actorId })).imports;

export const getAdminUsers = async (actorId: string) =>
  (await backendFetch<{ users: BackendUser[] }>("/api/internal/admin/users", { actorId })).users;

/**
 * Carga datos de admin sin romper la página: devuelve `{ data }` o `{ error }` con un
 * mensaje en español para mostrar.
 */
export async function loadAdmin<T>(load: () => Promise<T>): Promise<{ data: T; error: null } | { data: null; error: string }> {
  try {
    return { data: await load(), error: null };
  } catch (error) {
    console.error("[admin] error al leer datos del backend:", error);
    const message =
      error instanceof BackendError && error.status === 403
        ? "Tu cuenta ya no tiene permisos de admin. Vuelve a entrar para actualizar tu sesión."
        : "No pudimos leer los datos del servidor. Revisa que el backend esté en marcha e inténtalo de nuevo.";
    return { data: null, error: message };
  }
}

/** Etiquetas en español de los estados de importación. */
export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  success: "Exitosa",
  partial: "Parcial",
  failed: "Fallida",
};

/** Fecha y hora en formato de México, o un guion si no hay dato. */
export function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
}

/** Fecha sin hora (las fechas de precios ya vienen como YYYY-MM-DD). */
export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("es-MX", { dateStyle: "medium", timeZone: "UTC" });
}

export const formatNumber = (value: number) => value.toLocaleString("es-MX");

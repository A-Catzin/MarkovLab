import "server-only";

/**
 * Cliente del backend Julia para el servidor de Next.js. Todas las rutas internas
 * (`/api/internal/*`) llevan la clave compartida `X-Internal-Key`; las de admin, además,
 * el id del usuario que navega en `X-Actor-Id`, para que el backend verifique en la base
 * que sea admin. Nunca se importa desde el navegador (`server-only`).
 *
 * Variables de entorno: BACKEND_URL e INTERNAL_API_KEY.
 */

export type Role = "user" | "admin";

export interface BackendUser {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
}

/** Error de un llamado al backend: `status` es el HTTP (0 si no hubo respuesta) y `code` el campo `error`. */
export class BackendError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

// Margen para el primer llamado después de arrancar el backend (conexión al pooler de Supabase).
const BACKEND_TIMEOUT_MS = 10_000;

interface BackendRequest {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  /** Id del usuario que hace la acción; obligatorio en las rutas de admin. */
  actorId?: string;
}

/**
 * Llama a una ruta interna del backend y devuelve el JSON. Lanza `BackendError` si falta
 * la configuración, si el backend no responde o si responde con un error.
 */
export async function backendFetch<T>(path: string, { method = "GET", body, actorId }: BackendRequest = {}): Promise<T> {
  const baseUrl = process.env.BACKEND_URL;
  const key = process.env.INTERNAL_API_KEY;
  if (!baseUrl || !key) throw new BackendError(0, "not_configured", "BACKEND_URL o INTERNAL_API_KEY no están configuradas");

  const headers: Record<string, string> = { "X-Internal-Key": key };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (actorId) headers["X-Actor-Id"] = actorId;

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
  } catch (error) {
    throw new BackendError(0, "unreachable", `no se pudo contactar al backend: ${String(error)}`);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new BackendError(response.status, payload?.error ?? "http_error", payload?.message ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

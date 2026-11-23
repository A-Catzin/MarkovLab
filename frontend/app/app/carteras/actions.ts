"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BackendError, backendFetch } from "@/lib/backend";
import { requireUser } from "@/lib/guards";
import { isValidIsoDate } from "@/lib/modules/validators";
import type { Portfolio, Simulation } from "@/lib/portfolios";

/** Estado del formulario de nueva cartera: el mensaje de error, si lo hubo. */
export interface PortfolioFormState {
  error: string | null;
}

/** Mensajes en español para los errores que el backend devuelve en inglés. */
function friendlyError(message: string) {
  if (message.includes("sum to 1")) return "Los porcentajes tienen que sumar exactamente 100 %.";
  if (message.includes("unknown asset")) return "Uno de los activos ya no existe. Recarga la página y vuelve a elegirlo.";
  if (message.includes("only once")) return "Cada activo puede aparecer una sola vez.";
  if (message.includes("capital")) return "El capital tiene que ser de al menos 0.01.";
  if (message.includes("currency")) return "La moneda tiene que ser un código de tres letras, como MXN o USD.";
  if (message.includes("name")) return "Ponle un nombre a la cartera (hasta 120 caracteres).";
  if (message.includes("at least one asset")) return "Agrega al menos un activo.";
  if (message.includes("start_date") || message.includes("date")) return "La fecha de referencia debe ser válida (AAAA-MM-DD).";
  return "No pudimos guardar la cartera. Revisa los datos e inténtalo de nuevo.";
}

/**
 * Guarda una cartera nueva del usuario. Los pesos llegan en porcentaje y se mandan al
 * backend como fracciones; el backend valida todo de nuevo. Si sale bien, abre la cartera.
 */
export async function createPortfolio(_prev: PortfolioFormState, formData: FormData): Promise<PortfolioFormState> {
  const user = await requireUser();
  const assetIds = formData.getAll("asset_id").map((value) => Number(value));
  const percents = formData.getAll("weight").map((value) => Number(String(value).replace(",", ".")));
  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  if (startDateRaw && !isValidIsoDate(startDateRaw))
    return { error: "La fecha de referencia tiene que tener formato AAAA-MM-DD." };
  if (assetIds.length === 0 || assetIds.some((id) => !Number.isInteger(id) || id <= 0))
    return { error: "Elige un activo en cada fila." };
  if (percents.some((p) => !Number.isFinite(p))) return { error: "Escribe un porcentaje en cada fila." };

  let saved: Portfolio;
  try {
    const body: {
      name: string;
      capital: number;
      currency: string;
      start_date?: string;
      positions: { asset_id: number; weight: number }[];
    } = {
      name: String(formData.get("name") ?? ""),
      capital: Number(String(formData.get("capital") ?? "").replace(/,/g, "")),
      currency: String(formData.get("currency") ?? ""),
      // Se redondea a 6 decimales para que 33.33 % se mande como 0.3333 y no como 0.33329999…
      positions: assetIds.map((asset_id, i) => ({ asset_id, weight: Math.round(percents[i] * 1e4) / 1e6 })),
    };
    if (startDateRaw) body.start_date = startDateRaw;
    saved = await backendFetch<Portfolio>("/api/internal/portfolios", {
      method: "POST",
      actorId: user.id,
      body,
    });
  } catch (error) {
    if (error instanceof BackendError && error.status === 400) return { error: friendlyError(error.message) };
    console.error("[carteras] no se pudo guardar:", error);
    return { error: "No pudimos guardar la cartera porque el servidor no responde. Inténtalo en unos minutos." };
  }
  revalidatePath("/app/carteras");
  redirect(`/app/carteras/${saved.id}`);
}

/** Edita una cartera existente creando una versión previa en el historial del backend (B3). */
export async function updatePortfolioAction(
  portfolioId: string,
  input: {
    name: string;
    capital: number;
    currency: string;
    startDate: string;
    positions: { assetId: number; percent: number }[];
  },
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  try {
    await backendFetch<Portfolio>(`/api/internal/portfolios/${encodeURIComponent(portfolioId)}`, {
      method: "PUT",
      actorId: user.id,
      body: {
        name: input.name.trim(),
        capital: input.capital,
        currency: input.currency,
        start_date: input.startDate.trim() || null,
        positions: input.positions.map((pos) => ({
          asset_id: pos.assetId,
          weight: Math.round(pos.percent * 1e4) / 1e6,
        })),
      },
    });
    revalidatePath("/app/carteras");
    revalidatePath(`/app/carteras/${portfolioId}`);
    revalidatePath(`/app/carteras/${portfolioId}/editar`);
    return { ok: true };
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) {
      return { ok: false, error: "Esta cartera ya no existe o pertenece a otro usuario." };
    }
    if (error instanceof BackendError && error.status === 400) {
      return { ok: false, error: friendlyError(error.message) };
    }
    console.error("[carteras] no se pudo actualizar:", error);
    return { ok: false, error: "No pudimos actualizar la cartera porque el servidor no responde." };
  }
}

/** Duplica una cartera de forma atómica sin alterar la cartera de origen ni sus versiones (B3). */
export async function duplicatePortfolioAction(
  portfolioId: string,
  name?: string,
): Promise<{ ok: boolean; newPortfolioId?: string; newName?: string; error?: string }> {
  const user = await requireUser();
  try {
    const cleanName = name?.trim();
    const created = await backendFetch<Portfolio & { derived_from_id?: string }>(
      `/api/internal/portfolios/${encodeURIComponent(portfolioId)}/duplicate`,
      {
        method: "POST",
        actorId: user.id,
        body: cleanName ? { name: cleanName } : {},
      },
    );
    revalidatePath("/app/carteras");
    return { ok: true, newPortfolioId: created.id, newName: created.name };
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) {
      return { ok: false, error: "Esta cartera ya no existe o pertenece a otro usuario." };
    }
    if (error instanceof BackendError && error.status === 400) {
      return { ok: false, error: friendlyError(error.message) };
    }
    console.error("[carteras] no se pudo duplicar:", error);
    return { ok: false, error: "No pudimos duplicar la cartera porque el servidor no responde." };
  }
}

/** Borra una cartera del usuario y vuelve a la lista. El backend solo borra carteras propias. */
export async function deletePortfolio(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  let outcome = "deleted=1";
  try {
    await backendFetch(`/api/internal/portfolios/${encodeURIComponent(id)}`, { method: "DELETE", actorId: user.id });
  } catch (error) {
    console.error("[carteras] no se pudo borrar:", error instanceof BackendError ? error.code : error);
    outcome = "error=delete";
  }
  revalidatePath("/app/carteras");
  redirect(`/app/carteras?${outcome}`);
}

/** Estado del formulario "Simular": la simulación nueva o el mensaje de error. */
export interface SimulationFormState {
  simulation: Simulation | null;
  error: string | null;
}

// Horizontes que ofrece la página, en días hábiles, y confianzas permitidas.
const HORIZONS = new Set([21, 63, 252]);
const CONFIDENCES = new Set([0.95, 0.99]);

/**
 * Simula una cartera del usuario con los precios de la base y guarda el resultado. El
 * backend vuelve a validar los parámetros y que la cartera sea del usuario.
 */
export async function simulatePortfolio(_prev: SimulationFormState, formData: FormData): Promise<SimulationFormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const horizon = Number(formData.get("horizon"));
  const confidence = Number(formData.get("confidence"));
  if (!HORIZONS.has(horizon) || !CONFIDENCES.has(confidence))
    return { simulation: null, error: "Elige un plazo y un nivel de confianza." };

  try {
    const simulation = await backendFetch<Simulation>(`/api/internal/portfolios/${encodeURIComponent(id)}/simulations`, {
      method: "POST",
      actorId: user.id,
      body: { horizon, confidence },
    });
    revalidatePath(`/app/carteras/${id}`);
    return { simulation, error: null };
  } catch (error) {
    if (error instanceof BackendError && error.code === "missing_exchange_rate")
      return {
        simulation: null,
        error: "Falta el tipo de cambio para valuar estos activos en la moneda de la cartera. Pídele a un administrador que lo cargue.",
      };
    if (error instanceof BackendError && error.status === 422)
      return {
        simulation: null,
        error: "Los activos de esta cartera todavía no tienen suficientes días de precios en común para simular.",
      };
    if (error instanceof BackendError && error.status === 404)
      return { simulation: null, error: "Esta cartera ya no existe." };
    console.error("[carteras] no se pudo simular:", error instanceof BackendError ? error.code : error);
    return { simulation: null, error: "No pudimos simular la cartera porque el servidor no responde. Inténtalo en unos minutos." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BackendError, backendFetch } from "@/lib/backend";
import { requireUser } from "@/lib/guards";

export async function updateWatchlist(method: "PUT" | "DELETE", data: FormData) {
  const user = await requireUser();
  const id = Number(data.get("asset_id"));
  const route = "/app/mercado";
  if (!Number.isSafeInteger(id) || id <= 0) redirect(route + "?error=update");
  try {
    await backendFetch(`/api/internal/watchlist/${id}`, { method, actorId: user.id });
  } catch {
    redirect(route + "?error=update");
  }
  revalidatePath(route);
  redirect(method === "PUT" ? `${route}?asset=${id}` : route);
}

export async function requestMarketRefresh() {
  const user = await requireUser();
  const route = "/app/mercado";
  let outcome = "accepted";
  try {
    await backendFetch("/api/internal/watchlist/refresh", { method: "POST", actorId: user.id });
  } catch (error) {
    outcome = error instanceof BackendError && error.code === "no_refreshable_assets"
      ? "no-assets" : "unavailable";
  }
  redirect(`${route}?refresh=${outcome}`);
}

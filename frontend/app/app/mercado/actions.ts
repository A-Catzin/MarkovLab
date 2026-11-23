"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { backendFetch } from "@/lib/backend";
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

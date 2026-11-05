"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BackendError, backendFetch, type BackendUser } from "@/lib/backend";
import { requireAdmin } from "@/lib/guards";

/**
 * Cambia el rol de un usuario. Lo revisa dos veces: aquí (la sesión debe ser de un admin)
 * y en el backend, que verifica en la base que el actor sea admin y que no se quite el rol
 * al último admin. El resultado vuelve a /admin/usuarios en `?ok=` o `?error=`.
 */
export async function changeRole(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || (role !== "user" && role !== "admin")) redirect("/admin/usuarios?error=invalid");

  let outcome: string;
  try {
    await backendFetch<BackendUser>(`/api/internal/admin/users/${encodeURIComponent(userId)}/role`, {
      method: "PUT",
      body: { role },
      actorId: admin.id,
    });
    outcome = `ok=${role}`;
  } catch (error) {
    const code = error instanceof BackendError ? error.code : "unknown";
    console.error("[admin] no se pudo cambiar el rol:", code);
    outcome = `error=${encodeURIComponent(code)}`;
  }
  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios?${outcome}`);
}

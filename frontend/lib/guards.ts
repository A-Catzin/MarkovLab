import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./auth";

/**
 * Guardas de servidor para las páginas con sesión. Se llaman en los layouts de /app y
 * /admin, antes de renderizar nada.
 */

/** Usuario con sesión; sin sesión (o si el usuario ya no existe), redirige a /login. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

/**
 * Usuario admin; si no lo es, redirige a /app. Esta revisión es para la navegación: los
 * datos de admin los vuelve a verificar el backend en la base en cada solicitud.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/app");
  return user;
}

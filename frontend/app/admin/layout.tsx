import { AppShell } from "@/components/app/AppShell";
import { requireAdmin } from "@/lib/guards";

/**
 * Páginas de /admin: exigen sesión con rol admin. Sin sesión redirige a /login y sin rol
 * admin, a /app. El backend vuelve a verificar el rol en la base en cada consulta.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <AppShell user={user}>{children}</AppShell>;
}

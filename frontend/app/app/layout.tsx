import { AppShell } from "@/components/app/AppShell";
import { requireUser } from "@/lib/guards";

/** Páginas de /app: exigen sesión (cualquier rol). Sin sesión, redirige a /login. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}

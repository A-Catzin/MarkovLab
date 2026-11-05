import { SignOutButton } from "@/components/auth/AuthButtons";
import { Wordmark } from "@/components/brand/Wordmark";
import { NavLinks, type NavItem } from "./NavLinks";

/** Páginas de todo usuario con sesión. */
const USER_NAV: NavItem[] = [
  { href: "/app", label: "Inicio" },
  { href: "/app/carteras", label: "Mis carteras" },
  { href: "/app/simulador", label: "Simulador" },
];

/** Páginas que además ve un admin. */
const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/activos", label: "Activos" },
  { href: "/admin/importaciones", label: "Importaciones" },
  { href: "/admin/usuarios", label: "Usuarios" },
];

interface ShellUser {
  email?: string | null;
  role: "user" | "admin";
}

/**
 * Marco de las páginas con sesión: logo, navegación según el rol, correo y "Salir". Los
 * enlaces de admin solo se muestran a admins; la protección real está en los layouts y
 * en el backend.
 */
export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="shell__top">
        <Wordmark href="/app" />
        <nav className="shell__nav" aria-label="Navegación principal">
          <NavLinks items={USER_NAV} label="Laboratorio" />
          {user.role === "admin" && (
            <div className="shell__admin">
              <span className="shell__badge">Admin</span>
              <NavLinks items={ADMIN_NAV} label="Administración" />
            </div>
          )}
        </nav>
        <div className="shell__account">
          <span className="shell__email">{user.email}</span>
          <SignOutButton className="link shell__signout" />
        </div>
      </header>
      <main className="shell__main">{children}</main>
    </div>
  );
}

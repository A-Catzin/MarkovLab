import { SignOutButton } from "@/components/auth/AuthButtons";
import { Wordmark } from "@/components/brand/Wordmark";
import { NavLinks, type NavItem } from "./NavLinks";

/** Páginas publicadas de todo usuario con sesión. */
export const USER_NAV: NavItem[] = [
  { href: "/app", label: "Inicio" },
  { href: "/app/carteras", label: "Mis carteras" },
  { href: "/app/mercado", label: "Mercado" },
  { href: "/app/mercado/analisis", label: "Análisis" },
  { href: "/app/optimizacion", label: "Optimización" },
  { href: "/app/prediccion", label: "Predicción" },
  { href: "/app/simulador", label: "Simulador" },
];

/** Módulos en fase de vista previa local cuando `MARKOVLAB_USE_LOCAL_FIXTURES=1`. */
export const PREVIEW_APP_NAV: NavItem[] = [
  { href: "/app/backtesting", label: "Backtesting" },
  { href: "/app/reportes", label: "Reportes" },
];

/** Destinos del banco visual local (`/dev/vistas`). */
export const DEV_PREVIEW_NAV: NavItem[] = [
  { href: "/dev/vistas", label: "Índice F1–F7" },
  { href: "/dev/vistas/dashboard", label: "Dashboard" },
  { href: "/dev/vistas/analisis", label: "F1 Análisis" },
  { href: "/dev/vistas/mercado", label: "F2 Mercado" },
  { href: "/dev/vistas/cartera-editar", label: "F2 Carteras" },
  { href: "/dev/vistas/estres", label: "F3 Estrés" },
  { href: "/dev/vistas/optimizacion", label: "F4 Optimización" },
  { href: "/dev/vistas/prediccion", label: "F5 Predicción" },
  { href: "/dev/vistas/backtesting", label: "F6 Backtesting" },
  { href: "/dev/vistas/reportes", label: "F7 Reportes" },
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
export function AppShell({
  user,
  navItems,
  showPreviewNav = false,
  signOutHref,
  children,
}: {
  user: ShellUser;
  navItems?: NavItem[];
  showPreviewNav?: boolean;
  signOutHref?: string;
  children: React.ReactNode;
}) {
  const resolvedItems = navItems ?? (showPreviewNav ? [...USER_NAV, ...PREVIEW_APP_NAV] : USER_NAV);

  return (
    <div className="shell">
      <header className="shell__top">
        <Wordmark href={navItems?.[0]?.href ?? "/app"} />
        <nav className="shell__nav" aria-label="Navegación principal">
          <NavLinks items={resolvedItems} label="Laboratorio" />
          {user.role === "admin" && (
            <div className="shell__admin">
              <span className="shell__badge">Admin</span>
              <NavLinks items={ADMIN_NAV} label="Administración" />
            </div>
          )}
        </nav>
        <div className="shell__account">
          <span className="shell__email">{user.email}</span>
          {signOutHref ? (
            <a className="link shell__signout" href={signOutHref}>
              Volver a portada
            </a>
          ) : (
            <SignOutButton className="link shell__signout" />
          )}
        </div>
      </header>
      <main className="shell__main">{children}</main>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { RevealOnScroll } from "@/components/landing/RevealOnScroll";

const NAV = [
  { href: "/app", label: "Inicio" },
  { href: "/app/simulador", label: "Simulador" },
  { href: "/app/carteras", label: "Carteras" },
  { href: "/app/optimizacion", label: "Optimización" },
  { href: "/app/backtesting", label: "Backtesting" },
  { href: "/app/historial", label: "Historial" },
];

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <header className="app-shell__top">
        <Wordmark href="/app" />

        <nav className="app-shell__nav" aria-label="Aplicación">
          <ul>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="app-shell__account">
          <span className="app-shell__mode">Sesión de prueba</span>
          <Link className="link" href="/">
            Sitio
          </Link>
          <Link className="link" href="/login">
            Salir
          </Link>
        </div>
      </header>

      <main className="app-shell__main" id="contenido">
        {children}
      </main>

      {/* Las páginas de la app usan data-reveal; al cambiar de ruta hay que volver a observarlas. */}
      <RevealOnScroll key={pathname} />
    </div>
  );
}

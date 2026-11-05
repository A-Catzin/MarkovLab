"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Enlaces de navegación con la página actual marcada (`aria-current="page"`). La ruta
 * raíz de cada grupo (/app, /admin) solo se marca cuando es exactamente la página actual.
 */
export function NavLinks({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  const isCurrent = (href: string) =>
    href === "/app" || href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <ul className="shell__links" aria-label={label}>
      {items.map((item) => (
        <li key={item.href}>
          <Link className="shell__link" href={item.href} aria-current={isCurrent(item.href) ? "page" : undefined}>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

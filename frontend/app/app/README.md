# Espacio autenticado (`/app`)

## Overview
Área de trabajo autenticada de MarkovLab. `layout.tsx` valida la sesión en el servidor y envuelve todas las vistas hijas con `AppShell`, agrupando la portada del laboratorio (`/app`), el simulador de ejemplo (`/app/simulador`) y la gestión completa de carteras (`/app/carteras/*`).

## Interface
- `[layout.tsx:AppLayout]`: Layout servidor que exige usuario autenticado vía `requireUser()` (`@/lib/guards`) y renderiza `<AppShell user={user}>`.
- `[page.tsx:metadata]`: Configuración `Metadata` para `/app` (`title: "Inicio · MarkovLab"`).
- `[page.tsx:AppHomePage]`: Server Component de bienvenida que saluda por nombre y muestra el catálogo de módulos (`MODULES`).
- `carteras`: [`./carteras/README.md`](./carteras/README.md) — Listado, creación, historial diario y simulaciones persistidas de carteras.
- `simulador`: [`./simulador/README.md`](./simulador/README.md) — Simulador Monte Carlo con la cartera de ejemplo dentro del marco autenticado.

## Invariants
- `[layout.tsx:AppLayout]`: Toda ruta bajo `/app/*` exige una sesión válida vía `requireUser()`; sin sesión, redirige a `/login`.
- `[page.tsx:MODULES]`: Define los cuatro módulos del SRS: `"Simulador de riesgo"` (`status: "Disponible"`, `href: "/app/simulador"`), `"Mis carteras"` (`status: "En construcción"`, `href: "/app/carteras"`), y `"Optimización"` y `"Backtesting"` (`status: "Próximamente"`, renderizados con `aria-disabled="true"`).

## Side Effects
- `[layout.tsx:requireUser]` / `[page.tsx:requireUser]`: Leen la sesión del servidor (`getSession`) y ejecutan `redirect("/login")` cuando no hay sesión activa.

## Verification
- Run: `npm run typecheck && npm run build`

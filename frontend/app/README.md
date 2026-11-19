# Aplicación (`frontend/app`)

## Overview
Páginas, navegación y estructura de la aplicación frontend (Next.js App Router). Define el layout raíz (`layout.tsx`), la página pública de inicio (`page.tsx`), los estilos base y de tema (`globals.css`, `experience.css`), las rutas de autenticación y el área de laboratorio y administración.

### Notas de diseño y arquitectura
- `layout.tsx`: idioma (`es`), tipografías (`Young_Serif` y `Source_Serif_4` con `next/font/google`), carga de `globals.css` + `experience.css` y el script que agrega la clase `js` para animaciones de entrada.
- `page.tsx`: página de inicio pública; compone las secciones de [`components/landing/`](../components/landing/).
- `login/page.tsx`: inicio de sesión con Google; muestra errores de `?error=...`.
- `app/`: espacio autenticado bajo `app/layout.tsx` (`requireUser` de `lib/guards.ts`), que incluye inicio (`/app`), simulador (`/app/simulador`) y gestión de carteras (`/app/carteras`, `/app/carteras/nueva`, `/app/carteras/[id]`).
- `admin/`: panel administrativo bajo `admin/layout.tsx` (`requireAdmin` de `lib/guards.ts`) con resumen, activos, importaciones CSV y gestión de roles.
- `api/auth/[...nextauth]/route.ts`: rutas de Auth.js. Ver [`AUTENTICACION.md`](../../documentacion/tecnica/AUTENTICACION.md).
- `globals.css` y `experience.css`: tokens base, paleta azul marino profundo con oro, estilos de la portada, acceso y área de trabajo (`AppShell`), y soporte para `prefers-reduced-motion`.

Diseño documentado en [`LANDING.md`](../../documentacion/tecnica/LANDING.md). Los cálculos financieros y la persistencia pertenecen al backend Julia.

## Interface
- `[layout.tsx:metadata]`: Configuración `Metadata` raíz (`title: "MarkovLab · Simulación y riesgo de carteras"`).
- `[layout.tsx:RootLayout]`: Layout raíz que envuelve `children` con `<html lang="es">`, variables CSS de tipografía y hojas `globals.css` y `experience.css`.
- `[page.tsx:LandingPage]`: Server Component de la portada pública (`Hero`, `Intro`, `Simulator`, `Modules`, `Pipeline`, `Questions`, `SiteFooter`, `RevealOnScroll`).
- `admin`: [`./admin/README.md`](./admin/README.md) — Panel de administración protegido por `requireAdmin`.
- `api`: [`./api/README.md`](./api/README.md) — Rutas HTTP de Next.js App Router (`./api/auth/[...nextauth]`).
- `app`: [`./app/README.md`](./app/README.md) — Espacio autenticado del usuario (`/app`, `/app/simulador`, `/app/carteras/*`).
- `login`: [`./login/README.md`](./login/README.md) — Página pública de inicio de sesión con Google (`/login`).

## Invariants
- `[layout.tsx:RootLayout]`: Define `--font-display` (`Young_Serif`) y `--font-text` (`Source_Serif_4`) en `<html lang="es">` con `suppressHydrationWarning`. Todo el contenido permanece legible si JavaScript está deshabilitado.
- `[page.tsx:LandingPage]`: Calcula el resultado inicial de la demostración Monte Carlo de forma síncrona mediante `runDemo(DEFAULT_REQUEST)` para hidratar `<Simulator initial={initial} />`.

## Side Effects
- `[layout.tsx:RootLayout]`: Inserta `<script>` en `<head>` para añadir la clase `js` en `document.documentElement` y habilitar animaciones progresivas en el cliente.
- `[layout.tsx:Young_Serif]`: Carga fuentes de Google (`Young_Serif` y `Source_Serif_4`) vía `next/font/google`.

## Verification
- Run: `npm run typecheck && npm run build`

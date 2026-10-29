# Aplicación (`frontend/app`)

## Overview
Páginas, navegación y estructura de la aplicación frontend (Next.js App Router). Define el layout raíz (`layout.tsx`), la página pública de inicio (`page.tsx`), los estilos globales (`globals.css`) y las rutas de autenticación y laboratorio.

### Notas de diseño y arquitectura
- `layout.tsx`: idioma, tipografías (`Young Serif` y `Source Serif 4` con `next/font`) y la clase `js` que activa las animaciones.
- `page.tsx`: página de inicio; compone las secciones de [`components/landing/`](../components/landing/).
- `login/page.tsx`: inicio de sesión con Google; muestra los errores de `?error=...`.
- `app/page.tsx`: página principal de la aplicación; exige sesión (`getSession` de `lib/auth.ts`).
- `api/auth/[...nextauth]/route.ts`: rutas de Auth.js. Ver [`AUTENTICACION.md`](../../documentacion/tecnica/AUTENTICACION.md).
- `globals.css`: tokens de color, tipo y espacio, estilos de cada sección y movimiento con alternativa para `prefers-reduced-motion`.

Diseño documentado en [`LANDING.md`](../../documentacion/tecnica/LANDING.md). Los cálculos financieros y la persistencia pertenecen al backend Julia.

## Interface
- `[layout.tsx:metadata]`: Next.js `Metadata` configuration (`title: "MarkovLab · Simulación y riesgo de carteras"`).
- `[layout.tsx:RootLayout]`: Root layout Server Component wrapping `children` with `<html lang="es">` and typography CSS variables.
- `[page.tsx:LandingPage]`: Default exported Server Component rendering the landing page sections (`Hero`, `Intro`, `Simulator`, `Modules`, `Pipeline`, `Questions`, `SiteFooter`, and `RevealOnScroll`).
- `api`: [`./api/README.md`](./api/README.md) - Next.js App Router API routes subtree (`./api/auth/[...nextauth]`).
- `app`: [`./app/README.md`](./app/README.md) - Authenticated user dashboard page (`/app`).
- `login`: [`./login/README.md`](./login/README.md) - Google OAuth sign-in page (`/login`).

## Invariants
- `[layout.tsx:RootLayout]`: Binds `--font-display` (`Young_Serif`) and `--font-text` (`Source_Serif_4`) CSS variables on `<html lang="es">` with `suppressHydrationWarning`. Content remains visible if scripts are disabled.
- `[page.tsx:LandingPage]`: Computes initial Monte Carlo demo output synchronously via `runDemo(DEFAULT_REQUEST)` from `@/lib/demo` and `@/lib/landing-data` to hydrate `<Simulator initial={initial} />`.

## Side Effects
- `[layout.tsx:RootLayout]`: Injects an inline `<script>` (`document.documentElement.classList.add('js')`) in `<head>` to enable progressive-enhancement entry animations on the client.
- `[layout.tsx:Young_Serif]`: Loads Google Fonts (`Young_Serif` and `Source_Serif_4`) via `next/font/google`.

## Verification
- Run: `npm run typecheck && npm run build`

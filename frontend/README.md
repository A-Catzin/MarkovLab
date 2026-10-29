# Frontend de MarkovLab

## Overview

Interfaz de usuario de MarkovLab construida con **Next.js (App Router)**, **TypeScript** y **Tailwind CSS**. Comprende la presentación pública de la plataforma, un simulador Monte Carlo reproducible en el navegador (`normal-rebalanced-v1`), autenticación OAuth con Google mediante Auth.js (`next-auth`) y el espacio de trabajo autenticado del analista.

El diseño y componentes están documentados en [`LANDING.md`](../documentacion/tecnica/LANDING.md); el flujo de autenticación en [`AUTENTICACION.md`](../documentacion/tecnica/AUTENTICACION.md) y la integración con la API en [`API.md`](../documentacion/tecnica/API.md).

### Rutas principales

| Ruta | Archivo | Responsabilidad |
| --- | --- | --- |
| `/` | `app/page.tsx` | Portada científica con navegación, contexto histórico y simulador interactivo. |
| `/login` | `app/login/page.tsx` | Inicio de sesión con Google, con un abanico de trayectorias que se dibuja al entrar y sigue corriendo con pulsos de luz. Redirige a `/app` si ya existe sesión activa. |
| `/app` | `app/app/page.tsx` | Dashboard principal autenticado con acceso a los módulos cuantitativos. |
| `/api/auth/*` | `app/api/auth/[...nextauth]/route.ts` | Endpoints de Auth.js (OAuth sign-in, callbacks, sesión y cierre de sesión). |

## Subdirectories & Boundaries

- `app`: [`./app/README.md`](./app/README.md) — Árbol de rutas Next.js App Router, layout raíz con fuentes tipográficas y páginas `/`, `/login`, `/app` y `/api/auth`.
- `components`: [`./components/README.md`](./components/README.md) — Elementos reutilizables de UI divididos en autenticación (`auth`), identidad y moneda 3D (`brand`) y secciones de portada (`landing`).
- `lib`: [`./lib/README.md`](./lib/README.md) — Motor Monte Carlo en navegador (`simulation.ts`), ejecutor de demo (`demo.ts`), datos estáticos (`landing-data.ts`) y configuración Auth.js (`auth.ts`).
- `types`: [`./types/README.md`](./types/README.md) — Aumentos de tipos TypeScript (`next-auth.d.ts`) para propagar el `userId` de PostgreSQL en sesiones de Auth.js.

## Verification

- Run: `npm run typecheck && npm run build`

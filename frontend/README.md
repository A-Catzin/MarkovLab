# Frontend de MarkovLab

## Overview

Interfaz de usuario de MarkovLab construida con **Next.js (App Router)**, **TypeScript** y **Tailwind CSS**. Comprende la presentación pública de la plataforma, un simulador Monte Carlo reproducible en el navegador (`normal-rebalanced-v1`), autenticación OAuth con Google mediante Auth.js (`next-auth`) y el espacio de trabajo autenticado del analista.

El diseño y componentes están documentados en [`LANDING.md`](../documentacion/tecnica/LANDING.md); el flujo de autenticación en [`AUTENTICACION.md`](../documentacion/tecnica/AUTENTICACION.md) y la integración con la API en [`API.md`](../documentacion/tecnica/API.md).

### Rutas principales

| Ruta | Archivo | Responsabilidad |
| --- | --- | --- |
| `/` | `app/page.tsx` | Portada científica con navegación, contexto histórico y simulador interactivo. |
| `/login` | `app/login/page.tsx` | Inicio de sesión con Google, con un abanico de trayectorias que se dibuja al entrar y sigue corriendo con pulsos de luz. Redirige a `/app` si ya existe sesión activa. |
| `/app` | `app/app/page.tsx` | Inicio con sesión (cualquier rol): saludo y módulos. El layout `app/app/layout.tsx` exige sesión y pone la navegación. |
| `/app/carteras` | `app/app/carteras/page.tsx` | Mis carteras: lista de las carteras del usuario. |
| `/app/carteras/nueva` | `app/app/carteras/nueva/page.tsx` | Formulario de nueva cartera (`components/app/PortfolioForm.tsx`, acción en `actions.ts`). |
| `/app/carteras/{id}` | `app/app/carteras/[id]/page.tsx` | Detalle de una cartera: valor histórico diario, simulación Monte Carlo persistida, composición y borrado. Ver [`CARTERAS.md`](../documentacion/tecnica/CARTERAS.md). |
| `/app/simulador` | `app/app/simulador/page.tsx` | Simulador con la cartera de ejemplo. |
| `/admin` | `app/admin/page.tsx` | Solo admins (`app/admin/layout.tsx`): resumen de usuarios, activos, precios y última importación. |
| `/admin/activos` | `app/admin/activos/page.tsx` | Catálogo de activos con precios cargados. |
| `/admin/importaciones` | `app/admin/importaciones/page.tsx` | Subida de CSV (`components/app/ImportForm.tsx`, acción en `actions.ts`) e historial de importaciones. |
| `/admin/usuarios` | `app/admin/usuarios/page.tsx` | Usuarios y cambio de rol (acción de servidor en `actions.ts`). Ver [`ROLES.md`](../documentacion/tecnica/ROLES.md). |
| `/api/auth/*` | `app/api/auth/[...nextauth]/route.ts` | Endpoints de Auth.js (OAuth sign-in, callbacks, sesión y cierre de sesión). |

## Subdirectories & Boundaries

- `app`: [`./app/README.md`](./app/README.md) — Árbol de rutas Next.js App Router, layout raíz con fuentes tipográficas y estilos (`globals.css`, `experience.css`), y rutas `/`, `/login`, `/app/*`, `/admin/*` y `/api/auth`.
- `components`: [`./components/README.md`](./components/README.md) — Elementos reutilizables de UI divididos en autenticación (`auth`), identidad y moneda 3D (`brand`), portada pública (`landing`) y espacio autenticado / admin (`app`).
- `lib`: [`./lib/README.md`](./lib/README.md) — Cliente del backend (`backend.ts`), guardas de sesión (`guards.ts`), Auth.js (`auth.ts`), clientes de carteras y administración (`portfolios.ts`, `admin.ts`), simulador en navegador (`simulation.ts`, `demo.ts`) y datos editoriales (`landing-data.ts`).
- `types`: [`./types/README.md`](./types/README.md) — Aumentos de tipos TypeScript (`next-auth.d.ts`) para propagar `userId`, `role` y `roleCheckedAt` en sesiones y JWT de Auth.js.

## Verification

- Run: `npm run typecheck && npm run build`

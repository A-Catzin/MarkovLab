# Application Home (`/app`)

## Overview
Authenticated main workspace page (`page.tsx`) for MarkovLab. Displays the user's session identity, sign-out control, and the catalog of application modules according to the SRS.

## Interface
- `[page.tsx:metadata]`: Next.js `Metadata` configuration (`title: "Inicio · MarkovLab"`).
- `[page.tsx:AppHomePage]`: Default exported async Server Component rendering the authenticated dashboard.

## Invariants
- `[page.tsx:AppHomePage]`: Enforces authentication; if `await getSession()` returns `null`, execution immediately halts via `redirect("/login")`.
- `[page.tsx:MODULES]`: Defines the four SRS modules; only `"Simulador de riesgo"` has `status: "Disponible"` and a navigable `href: "/#simulador"`, while `"Mis carteras"`, `"Optimización"`, and `"Backtesting"` are marked `"Próximamente"` with `aria-disabled="true"`.

## Side Effects
- `[page.tsx:getSession]`: Reads the current server-side session via `@/lib/auth`.
- `[page.tsx:redirect]`: Triggers an HTTP redirect to `/login` when the request is unauthenticated.

## Verification
- Run: `npm run typecheck && npm run build`

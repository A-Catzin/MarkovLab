# Login Page (`/login`)

## Overview
Public authentication entry page (`page.tsx`) providing Google OAuth sign-in and translating Auth.js query-string error codes (`?error=...`) into user-facing alerts.

## Interface
- `[page.tsx:metadata]`: Next.js `Metadata` configuration (`title: "Entrar · MarkovLab"`).
- `[page.tsx:LoginPage]`: Default exported async Server Component accepting `{ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }`.

## Invariants
- `[page.tsx:LoginPage]`: If `await getSession()` returns an active session, immediately invokes `redirect("/app")`.
- `[page.tsx:ERROR_MESSAGES]`: Maps `AccessDenied`, `OAuthSignin`, and `OAuthCallback` query error codes to localized diagnostic strings, falling back to `[page.tsx:DEFAULT_ERROR]` for unrecognized codes.

## Side Effects
- `[page.tsx:getSession]`: Checks server-side session state before rendering the login view.
- `[page.tsx:redirect]`: Triggers an HTTP redirect to `/app` when the user is already authenticated.

## Verification
- Run: `npm run typecheck && npm run build`

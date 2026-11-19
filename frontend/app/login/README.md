# Página de acceso (`/login`)

## Overview
Página pública de autenticación (`page.tsx`) con estética marino profundo y oro (`experience.css`), fondo animado (`AuthBackdrop`), datos de referencia (`FACTS`), botón de Google OAuth (`GoogleSignInButton`) y traducción de códigos de error (`?error=...`).

## Interface
- `[page.tsx:metadata]`: Configuración `Metadata` (`title: "Entrar · MarkovLab"`).
- `[page.tsx:LoginPage]`: Server Component asíncrono que recibe `{ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }` y compone `AuthBackdrop`, `Wordmark` y `GoogleSignInButton`.

## Invariants
- `[page.tsx:LoginPage]`: Si `await getSession()` devuelve una sesión activa, redirige de inmediato a `/app` (`redirect("/app")`).
- `[page.tsx:ERROR_MESSAGES]`: Traduce `EmailNotVerified`, `ServiceUnavailable`, `AccessDenied`, `OAuthSignin` y `OAuthCallback` a mensajes claros en español, con respaldo en `[page.tsx:DEFAULT_ERROR]`.
- `[page.tsx:FACTS]`: Muestra los tres valores de referencia del simulador (`10,000`, `Semilla`, `95 %`).

## Side Effects
- `[page.tsx:getSession]`: Consulta la sesión del servidor antes de renderizar la vista.
- `[page.tsx:redirect]`: Emite una redirección HTTP hacia `/app` cuando el usuario ya tiene sesión.

## Verification
- Run: `npm run typecheck && npm run build`

# `[...nextauth]` Route Handler

## Overview
Next.js App Router catch-all route handler (`route.ts`) that mounts Auth.js (`NextAuth`) for Google OAuth sign-in, callback processing (`/api/auth/callback/google`), session inspection, and sign-out.

## Interface
- `[route.ts:GET]`: HTTP `GET` handler exported from `NextAuth(authOptions)`.
- `[route.ts:POST]`: HTTP `POST` handler exported from `NextAuth(authOptions)`.

## Invariants
- `[route.ts:handler]`: Both `GET` and `POST` exports must delegate to `NextAuth(authOptions)` imported from `@/lib/auth`.

## Side Effects
- `[route.ts:GET]`: Handles OAuth sign-in redirects, Google callback verification (`/api/auth/callback/google`), and session state reads.
- `[route.ts:POST]`: Handles sign-in initiation, sign-out, and session cookie mutations.

## Verification
- Run: `npm run typecheck && npm run build`

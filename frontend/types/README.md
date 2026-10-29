# Tipos globales del frontend (`frontend/types`)

## Overview
Declaraciones de tipos y aumentos de módulos TypeScript (`module augmentation`) compartidos en el frontend para extender las interfaces de sesión y token de Auth.js (`next-auth`).

## Interface
- `[next-auth.d.ts:next-auth]`: Extiende la interfaz `Session` del módulo `"next-auth"` para tipar `user` como `DefaultSession["user"] & { id: string }`.
- `[next-auth.d.ts:next-auth/jwt]`: Extiende la interfaz `JWT` del módulo `"next-auth/jwt"` con la propiedad opcional `userId?: string`.

## Invariants
- `[next-auth.d.ts:Session]`: `session.user.id` representa el identificador del usuario persistido en PostgreSQL (`app_users.id`), propagado desde `JWT.userId` por los callbacks definidos en [`../lib/README.md`](../lib/README.md).

## Side Effects
- None

## Verification
- Run: `npm run typecheck && npm run build`

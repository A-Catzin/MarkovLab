# Tipos globales del frontend (`frontend/types`)

## Overview
Declaraciones de tipos y aumentos de módulos TypeScript (`module augmentation`) compartidos en el frontend para extender las interfaces de sesión, usuario y token JWT de Auth.js (`next-auth`).

## Interface
- `[next-auth.d.ts:next-auth]`: Extiende `Session` con `user: DefaultSession["user"] & { id: string; role: Role }` y `User` con `role?: Role` (`"user" | "admin"`).
- `[next-auth.d.ts:next-auth/jwt]`: Extiende `JWT` con las propiedades opcionales `userId?: string`, `role?: Role` y `roleCheckedAt?: number`.

## Invariants
- `[next-auth.d.ts:Session]`: `session.user.id` representa el identificador del usuario persistido en PostgreSQL (`usuarios.id`) y `session.user.role` su rol actualizado periódicamente tras `roleCheckedAt` desde [`../lib/README.md`](../lib/README.md).

## Side Effects
- None

## Verification
- Run: `npm run typecheck && npm run build`

# Panel de administración (`/admin`)

## Overview
Sección administrativa de MarkovLab (`layout.tsx`, páginas y Server Actions). Exige rol `admin` tanto en la navegación de Next.js (`requireAdmin`) como en cada petición al backend Julia (`X-Actor-Id` verificado en PostgreSQL). Ver [`ROLES.md`](../../../documentacion/tecnica/ROLES.md).

## Interface
- `[layout.tsx:AdminLayout]`: Layout servidor que exige usuario con rol `admin` mediante `requireAdmin()` (`@/lib/guards`) y renderiza `<AppShell user={user}>`.
- `[page.tsx:AdminHomePage]`: Portada `/admin` con conteos globales de usuarios, administradores, activos, filas en `precios_historicos` y última importación (`getAdminSummary`).
- `[activos/page.tsx:AdminAssetsPage]`: Catálogo `/admin/activos` con cantidad de precios, rango de fechas y última carga (`getAdminAssets`).
- `[importaciones/page.tsx:AdminImportsPage]` & `[importaciones/actions.ts:importCsv]`: Formulario de importación CSV (`ImportForm`) e historial de las últimas 100 importaciones (`getAdminImports`).
- `[usuarios/page.tsx:AdminUsersPage]` & `[usuarios/actions.ts:changeRole]`: Listado de usuarios y acción servidor para cambiar roles entre `user` y `admin`.

## Invariants
- `[layout.tsx:AdminLayout]` y `[importaciones/actions.ts:importCsv]` / `[usuarios/actions.ts:changeRole]`: Todas las vistas y acciones de servidor llaman a `requireAdmin()`, redirigiendo a `/login` sin sesión o a `/app` sin rol `admin`.
- `[importaciones/actions.ts:MAX_FILE_BYTES]`: Limita los archivos CSV subidos a `5_000_000` bytes (alineado con `MAX_UPLOAD_CSV_LENGTH` en el backend) y valida nombre, mercado y categoría antes de llamar a `POST /api/internal/admin/prices/import`.
- `[usuarios/actions.ts:changeRole]`: Solo acepta roles `"user"` o `"admin"`, propaga códigos de error (`last_admin`, `forbidden`, `not_found`, `invalid`) en la URL y revalida `/admin/usuarios`.

## Side Effects
- `[page.tsx:loadAdmin]`, `[activos/page.tsx:loadAdmin]`, `[importaciones/page.tsx:loadAdmin]`, `[usuarios/page.tsx:loadAdmin]`: Consultan endpoints `/api/internal/admin/*` vía `@/lib/admin` enviando `X-Internal-Key` y `X-Actor-Id`.
- `[importaciones/actions.ts:importCsv]`: Envía el contenido CSV al backend Julia, escribe en `activos`, `precios_historicos` y `sincronizaciones`, y revalida `/admin`, `/admin/importaciones` y `/admin/activos`.
- `[usuarios/actions.ts:changeRole]`: Ejecuta `PUT /api/internal/admin/users/{id}/role`, revalida `/admin/usuarios` y redirige con el resultado.

## Verification
- Run: `npm run typecheck && npm run build`

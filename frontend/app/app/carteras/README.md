# Mis carteras (`/app/carteras`)

## Overview
Flujo completo de gestión y análisis de carteras personales del usuario autenticado: listado, creación con pesos validados, gráfica interactiva de valor histórico, simulación Monte Carlo persistida y borrado. Ver [`CARTERAS.md`](../../../../documentacion/tecnica/CARTERAS.md).

## Interface
- `[page.tsx:PortfoliosPage]`: Lista las carteras del usuario (`getPortfolios`) y muestra avisos tras borrar (`?deleted=1` o `?error=delete`).
- `[nueva/page.tsx:NewPortfolioPage]`: Carga los activos del catálogo (`getCatalogAssets`) y renderiza `<PortfolioForm>`.
- `[[id]/page.tsx:PortfolioPage]`: Detalle de cartera que consulta en paralelo `getPortfolio`, `getPortfolioHistory` y `getSimulations`, componiendo `PortfolioHistoryChart`, `PortfolioSimulation`, la barra/tabla de composición y el formulario de borrado.
- `[actions.ts:createPortfolio]`, `[actions.ts:deletePortfolio]`, `[actions.ts:simulatePortfolio]`: Server Actions protegidas por `requireUser()` para crear, eliminar y simular carteras contra el backend Julia.

## Invariants
- `[page.tsx:requireUser]`, `[nueva/page.tsx:requireUser]`, `[[id]/page.tsx:requireUser]`, `[actions.ts:requireUser]`: Toda consulta y acción se ejecuta con el `actorId` (`user.id`) de la sesión verificada; el backend devuelve `404` ante carteras ajenas (`notFound()` en `[id]/page.tsx`).
- `[actions.ts:createPortfolio]`: Convierte los porcentajes del formulario a fracciones redondeadas a 6 decimales (`Math.round(p * 1e4) / 1e6`) antes de enviar `POST /api/internal/portfolios`.
- `[actions.ts:simulatePortfolio]`: Restringe las opciones enviadas desde la UI a los horizontes `HORIZONS` (`21`, `63`, `252` días hábiles) y confianzas `CONFIDENCES` (`0.95`, `0.99`), traduciendo errores `422` (`missing_exchange_rate` o historia insuficiente) a mensajes en español.

## Side Effects
- `[actions.ts:createPortfolio]`: Ejecuta `POST /api/internal/portfolios`, revalida `/app/carteras` y redirige a `/app/carteras/${saved.id}`.
- `[actions.ts:deletePortfolio]`: Ejecuta `DELETE /api/internal/portfolios/${id}`, revalida `/app/carteras` y redirige al listado.
- `[actions.ts:simulatePortfolio]`: Ejecuta `POST /api/internal/portfolios/${id}/simulations` persistiendo la simulación en PostgreSQL y revalida `/app/carteras/${id}`.

## Verification
- Run: `npm run typecheck && npm run build`

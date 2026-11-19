# Simulador autenticado (`/app/simulador`)

## Overview
Vista del simulador Monte Carlo dentro del espacio autenticado `/app`. Reutiliza el modelo de demostración de la portada pública (`runDemo` con `DEFAULT_REQUEST` y `<Simulator>`) bajo el marco `AppShell`.

## Interface
- `[page.tsx:metadata]`: Configuración `Metadata` de la ruta (`title: "Simulador · MarkovLab"`).
- `[page.tsx:SimulatorPage]`: Server Component que calcula el estado inicial de demostración (`runDemo(DEFAULT_REQUEST)`) y renderiza `<Simulator initial={initial} />` junto con `<RevealOnScroll />`.

## Invariants
- `[page.tsx:SimulatorPage]`: Protegido por `AppLayout` (`requireUser()`). Ejecuta los mismos parámetros ilustrativos por defecto de la portada pública (`DEFAULT_REQUEST`) sin escribir datos en PostgreSQL.
- `[page.tsx:RevealOnScroll]`: Se incluye explícitamente porque `<Simulator>` usa bloques con `data-reveal` heredados de la portada.

## Side Effects
- `[page.tsx:SimulatorPage]`: Ejecuta `runDemo(DEFAULT_REQUEST)` de forma síncrona en el servidor para el primer render; las simulaciones interactivas posteriores corren en el navegador mediante `<Simulator>`.

## Verification
- Run: `npm run typecheck && npm run build`

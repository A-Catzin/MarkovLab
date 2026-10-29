# Landing Components (`frontend/components/landing`)

## Overview
Section and interaction components composing the MarkovLab public landing page: hero fan chart and navigation (`Hero`), historical context (`Intro`), capability mosaic (`Modules`), latency breakdown (`Pipeline`), FAQ (`Questions`), scroll-triggered reveal observer (`RevealOnScroll`), interactive browser Monte Carlo simulator (`Simulator`), and site footer (`SiteFooter`).

## Interface
- `Hero()` — Landing header rendering top navigation, headline, `Coin`, and a deterministic 252-day SVG fan chart (`60` displayed paths and `2000` percentile band paths for p5, p50, p95) (`[Hero.tsx:Hero]`).
- `Intro()` — Historical background section (`#historia`) presenting `FACTS` and archival plates (`[Intro.tsx:Intro]`).
- `Modules()` — Architectural and feature mosaic section (`#modulos`) listing `IMPLEMENTED_METRICS` and domain constraints (`[Modules.tsx:Modules]`).
- `Pipeline()` — Request stage latency breakdown section (`#como-funciona`) aggregating `REQUEST_STAGES` durations (`[Pipeline.tsx:Pipeline]`).
- `Questions()` — Frequently asked questions section (`#preguntas`) rendering `QUESTIONS` via `QuestionRow` (`[Questions.tsx:Questions]`).
- `RevealOnScroll()` — Headless client component that observes `[data-reveal], .tile--photo` elements and adds the `is-in` CSS class on viewport intersection (`[RevealOnScroll.tsx:RevealOnScroll]`).
- `Simulator({ initial }: { initial: DemoResult })` — Interactive client component (`#simulador`) for configuring portfolio weights, capital, horizon, confidence level, and PRNG seed, running `runDemo` in the browser and rendering `ResultFigures` and `Histogram` (`[Simulator.tsx:Simulator]`).
- `SiteFooter()` — Footer component rendering navigation links, repository/API contract links (`REPOSITORY_URL`), Wikimedia Commons image attributions (`CREDITS`), and educational disclaimer (`[SiteFooter.tsx:SiteFooter]`).

## Invariants
- `Hero` clamps vertical fan-chart coordinates to `[Y_MIN, Y_MAX]` (`[0.7, 1.7]`) across `TRADING_DAYS` (`252`) with `SHOWN_PATHS = 60` (at `DEFAULT_REQUEST.seed`) and `BAND_PATHS = 2000` (at `DEFAULT_REQUEST.seed + 1`) (`[Hero.tsx:Y_MIN]`, `[Hero.tsx:Y_MAX]`, `[Hero.tsx:SHOWN_PATHS]`, `[Hero.tsx:BAND_PATHS]`, `[Hero.tsx:y]`, `[Hero.tsx:Hero]`).
- `Simulator` enforces input validity before running a simulation (`valid = total === 100 && Number.isInteger(seed) && seed >= 0 && capitalValid`), where `total` is the sum of asset percentage weights (`100`) and `capitalValid` requires `Number.isFinite(capital) && capital > 0 && capital <= MAX_CAPITAL` (`1_000_000_000`) (`[Simulator.tsx:MAX_CAPITAL]`, `[Simulator.tsx:Simulator]`).
- `Simulator` disables the submit button when `!valid` and guards `run()` with `if (!valid) return;` (`[Simulator.tsx:Simulator]`).
- `RevealOnScroll` returns `null` and unobserves each target immediately after adding `is-in` once (`[RevealOnScroll.tsx:RevealOnScroll]`).

## Side Effects
- `RevealOnScroll` queries the DOM (`document.querySelectorAll<HTMLElement>("[data-reveal], .tile--photo")`), mutates `document.documentElement.classList` (`no-observer` fallback when `IntersectionObserver` is unavailable) and target element `classList` (`is-in`), and registers/disconnects a browser `IntersectionObserver` (`[RevealOnScroll.tsx:RevealOnScroll]`).
- `Simulator` manages interactive React state (`weights`, `horizon`, `seed`, `confidence`, `capital`, `result`) via `useState`, reads wall-clock timing via `performance.now()`, and executes synchronous in-browser Monte Carlo simulations via `runDemo(request)` on form submission (`[Simulator.tsx:Simulator]`).

## Verification
- Run: `npm run typecheck && npm run build`

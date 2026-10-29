# Brand Components (`frontend/components/brand`)

## Overview
Visual identity and brand components for MarkovLab, including the SVG bimodal curve mark (`LogoMark`), the linked logotype (`Wordmark`), and the interactive 3D gold-and-blue-enamel coin (`Coin`).

## Interface
- `Coin({ className }: { className?: string })` — Client component that renders an interactive 3D MarkovLab coin on a `<canvas>` using dynamically imported Three.js (`[Coin.tsx:Coin]`).
- `LogoMark({ className }: { className?: string })` — Server-compatible SVG component rendering the bimodal curve with 9 equidistant arc-length state nodes (`[LogoMark.tsx:LogoMark]`).
- `Wordmark({ href = "/" }: { href?: string })` — Next.js `Link` logotype combining `LogoMark` and the `MarkovLab` text mark (`[Wordmark.tsx:Wordmark]`).

## Invariants
- `LogoMark` renders 9 state nodes at fixed x-coordinates `STATE_XS = [6, 11.9, 17.3, 25, 32, 39, 46.7, 52.1, 58]` along the bimodal curve `curveY(x)` (`[LogoMark.tsx:STATE_XS]`, `[LogoMark.tsx:curveY]`), with the initial node (`i === 0`) styled with `r={5}` and `fill="var(--accent)"` and remaining nodes using `r={3.5}` and `fill="currentColor"` (`[LogoMark.tsx:LogoMark]`).
- `Coin` places 9 state nodes at `STATES = [-2.6, -1.98, -1.42, -0.62, 0, 0.62, 1.42, 1.98, 2.6]` along `profile(x)` on a `1024 × 1024` 2D canvas texture (`[Coin.tsx:STATES]`, `[Coin.tsx:profile]`, `[Coin.tsx:drawFace]`).
- `Coin` caps WebGL pixel ratio to `Math.min(devicePixelRatio, 2)` (`[Coin.tsx:Coin]`).
- `Coin` disables auto-rotation when `(prefers-reduced-motion: reduce)` matches (`controls.autoRotate = !reduced`) and only enables pointer orbit controls when `(pointer: fine)` matches (`controls.enabled = finePointer`) (`[Coin.tsx:Coin]`).
- `Coin` pauses rendering inside `renderer.setAnimationLoop` whenever `visible` is `false` as reported by `IntersectionObserver` (`[Coin.tsx:Coin]`).
- `Wordmark` defaults `href` to `"/"` (`[Wordmark.tsx:Wordmark]`).

## Side Effects
- `Coin` dynamically imports `"three"`, `"three/examples/jsm/environments/RoomEnvironment.js"`, and `"three/examples/jsm/controls/OrbitControls.js"` inside `useEffect` on the client (`[Coin.tsx:Coin]`).
- `Coin` creates offscreen 2D `<canvas>` elements (`document.createElement("canvas")`), reads `--font-display` from `getComputedStyle(document.documentElement)`, awaits `document.fonts.ready` to redraw canvas textures, and instantiates a `THREE.WebGLRenderer` context on the mounted `<canvas>` (`[Coin.tsx:drawFace]`, `[Coin.tsx:Coin]`).
- `Coin` registers `ResizeObserver` and `IntersectionObserver` instances on the `<canvas>` and disposes all geometries, materials, textures, controls, observers, and the WebGL renderer on unmount (`[Coin.tsx:Coin]`).

## Verification
- Run: `npm run typecheck && npm run build`

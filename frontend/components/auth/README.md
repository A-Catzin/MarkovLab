# Auth Components (`frontend/components/auth`)

## Overview
Client-side authentication action buttons wrapping NextAuth (`next-auth/react`) session sign-in and sign-out flows for MarkovLab.

## Interface
- `GoogleSignInButton({ className }: { className?: string })` — Client component button that triggers Google OAuth sign-in and redirects to `/app` (`[AuthButtons.tsx:GoogleSignInButton]`).
- `SignOutButton({ className }: { className?: string })` — Client component button that signs out the current user and redirects to `/` (`[AuthButtons.tsx:SignOutButton]`).
- `AuthBackdrop()` — Server component that renders the decorative Monte Carlo fan behind `/login` (48 sample paths with seed 7, plus the 5th and 95th percentile bands from 1,000 paths). It is `aria-hidden`. Its `[data-draw]` paths are traced in on load by `globals.css`. After that, a single light pulse runs along 6 paths one at a time in a loop, using `.trace-pulse` copies (a class shared with the landing hero chart). Everything stays static under `prefers-reduced-motion` (`[AuthBackdrop.tsx:AuthBackdrop]`).

## Invariants
- `GoogleSignInButton` disables the button (`disabled={pending}`) and sets `aria-busy={pending}` once clicked to prevent duplicate sign-in requests while `pending` is `true` (`[AuthButtons.tsx:GoogleSignInButton]`).
- `GoogleSignInButton` always sets `callbackUrl: "/app"` for the `"google"` provider (`[AuthButtons.tsx:GoogleSignInButton]`).
- `SignOutButton` always sets `callbackUrl: "/"` on sign-out (`[AuthButtons.tsx:SignOutButton]`).

## Side Effects
- Maintains local React state (`pending`) via `useState(false)` in `GoogleSignInButton` (`[AuthButtons.tsx:GoogleSignInButton]`).
- Invokes `signIn("google", { callbackUrl: "/app" })` from `next-auth/react`, initiating an external OAuth redirect flow (`[AuthButtons.tsx:GoogleSignInButton]`).
- Invokes `signOut({ callbackUrl: "/" })` from `next-auth/react`, terminating the session and navigating to `/` (`[AuthButtons.tsx:SignOutButton]`).

## Verification
- Run: `npm run typecheck && npm run build`

# Componentes (`frontend/components`)

## Overview
Elementos de interfaz de MarkovLab. Las rutas y la composición de páginas pertenecen a [`app/`](../app/README.md); los datos, el modelo de simulación del navegador y las utilidades, a [`lib/`](../lib/README.md). Este directorio no reemplaza los cálculos del backend.

### Notas de arquitectura y diseño
- `landing/` contiene las secciones de la página de inicio: `Hero`, `Intro`, `Simulator`, `Modules`, `Pipeline`, `Questions`, `SiteFooter` y `RevealOnScroll`. Su diseño y comportamiento están documentados en [`LANDING.md`](../../documentacion/tecnica/LANDING.md).
- `Simulator`, `RevealOnScroll` y `brand/Coin` son componentes de cliente; los demás se renderizan en el servidor.
- `brand/LogoMark.tsx` es el símbolo de MarkovLab ("M recorrida"): una curva de dos picos que forma la M, con nueve estados sobre ella; el primero va en color de acento. Usa `currentColor`, así que toma el color del texto. `brand/Wordmark.tsx` es el logotipo completo (símbolo + "Markov" + "Lab" en acento) que usan `/login` y `/app`; el `Hero` de la landing repite el mismo marcado con su ancla `#top`. `brand/Coin.tsx` es la moneda 3D de la marca (oro y esmalte azul con el logo en relieve) que aparece en la portada; carga Three.js de forma dinámica y solo en el navegador. El favicon es `app/icon.svg`, con el mismo dibujo y trazo claro u oscuro según el tema del navegador.
- `auth/AuthButtons.tsx` tiene los botones de cliente "Continuar con Google" (`signIn`, con la "G" de Google) y "Salir" (`signOut`) de Auth.js. `auth/AuthBackdrop.tsx` dibuja en el servidor el abanico de trayectorias Monte Carlo del fondo de `/login`; sus líneas se trazan al entrar (`[data-draw]` en `globals.css`) y luego un pulso de luz las recorre de una en una, en ciclo de 6 líneas (`.trace-pulse`, compartida con el gráfico de la portada); todo queda quieto con `prefers-reduced-motion`. Ver [`AUTENTICACION.md`](../../documentacion/tecnica/AUTENTICACION.md).

## Subdirectories & Boundaries
- `auth`: [`./auth/README.md`](./auth/README.md) — Client-side NextAuth (`next-auth/react`) sign-in (`GoogleSignInButton`) and sign-out (`SignOutButton`) buttons.
- `brand`: [`./brand/README.md`](./brand/README.md) — Brand identity components (`LogoMark`, `Wordmark`, and the client-side Three.js 3D `Coin`).
- `landing`: [`./landing/README.md`](./landing/README.md) — Public landing page sections (`Hero`, `Intro`, `Modules`, `Pipeline`, `Questions`, `SiteFooter`), scroll reveal observer (`RevealOnScroll`), and interactive browser Monte Carlo demo (`Simulator`).

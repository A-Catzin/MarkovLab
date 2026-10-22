# Landing page de MarkovLab

Referencia del diseño y del código de la página de inicio (`frontend/app/page.tsx`). Explica la dirección visual, cada sección, el simulador del navegador, las imágenes y cómo verificar cambios.

## Idea

La página se compone como un **informe científico** —columna fija, mosaicos sin márgenes y bloques de color plano—, en referencia a la memoria de Andréi Márkov de 1913, de donde viene el nombre del proyecto. Se presenta sobre un fondo oscuro. Su figura principal es una simulación real del modelo del backend: 60 de 10,000 trayectorias con semilla 42.

Lo interactivo es el simulador: el visitante cambia pesos, horizonte, confianza y semilla, y su navegador calcula 10,000 escenarios con el mismo modelo que el motor Julia (`normal-rebalanced-v1`).

## Sistema visual

| Elemento | Valor |
|---|---|
| Fondo (negro azulado) | `--bg: #0a0d14`; superficies `--surface: #131824` y `--surface-2: #1c2333` |
| Campos azules | `--field: #16223a`, `--field-strong: #22365c`, `--field-accent: #2b4c88`, para bloques del mosaico, etapas y el dato de 3 ms |
| Texto | `--ink: #e9edf3` (blanco plateado); secundario `--muted: #8891a1` |
| Acento (aciano) | `--accent: #5a9bfc`, hover `--accent-hover: #82b4fd`, texto sobre acento `--accent-ink: #0a0d14` |
| Títulos | Young Serif 400, interletra -0.02em a -0.04em |
| Texto | Source Serif 4, 400 y 600, interlineado 1.55 |
| Tamaños | Cinco pasos y ninguno más: `--step-small` 15 px, `--step-body` 18 px, `--step-lead` 24 px, `--step-head` 56 px y `--step-display` hasta 144 px (valores en escritorio; se reducen con `clamp`). El título de portada supera a propósito el límite de 6rem que sugiere impeccable, a pedido del equipo. |
| Espaciado | Escala `--space-1` a `--space-6`: 8, 16, 24, 40, 64 y 96 px. Separación entre secciones `--section-gap`: 160 px en escritorio, 96 px en teléfono. Los valores sueltos solo aparecen dentro de fragmentos `data-ui`. |
| Márgenes y ejes | 32 px en escritorio, 20 px en teléfono, también en pantallas anchas (la página ocupa todo el ancho); grilla de 12 columnas. El texto se alinea a tres ejes: columna 1, columna 5 (eje de la portada, del simulador y del hallazgo de etapas) y columna 8 (nota de la historia, imágenes y respuestas). |
| Botón | Bloque aciano de esquinas rectas con texto oscuro |

Los números grandes (cifras del simulador, años, "3 ms", etapas y fichas del mosaico) usan Source Serif 4 en seminegrita con `lining-nums tabular-nums`: los números de Young Serif son de estilo antiguo (el 1 parece una I y el 3 baja de la línea) y se veían desprolijos. Young Serif queda para títulos y para el logo.

Las superficies del navegador también siguen la paleta: `color-scheme: dark`, barra de scroll (`scrollbar-color`), cursor de texto (`caret-color`), controles nativos (`accent-color`) y selección.

Reglas que se mantienen en toda la página: títulos de dos líneas como máximo, sin etiquetas pequeñas sobre los títulos, sin gradientes, sombras, monoespaciadas, numeración decorativa ni líneas divisorias. Las líneas solo aparecen dentro de fragmentos de interfaz marcados con `data-ui` (tablas, controles, gráfico).

Paleta de la biblioteca de la skill: "Night and cornflower". El aciano se reserva para el botón, la etiqueta "Resuelta", los controles del simulador, las bandas de percentiles del gráfico y las barras por debajo del VaR. Ninguna sección cambia el color de fondo; el pie usa `--surface`.

Los tokens viven en `frontend/app/globals.css`; los componentes no usan colores sueltos.

**Historial:** la primera versión usaba cobalto sobre arena (`#062b8a` sobre `#e6dbc7`). Se reemplazó el 2026-10-21 por una paleta oscura menos brillante, a pedido del equipo.

## Secciones

| Sección | Componente | Contenido |
|---|---|---|
| Portada | `Hero.tsx` | Nombre, frase de qué es, botón al simulador, titular "Simula tu cartera", dato de 3 ms y gráfico de trayectorias con percentiles 5, 50 y 95. |
| Historia | `Intro.tsx` | Por qué Márkov: cronología 1900, 1913, 1948 y 10,000; relato de Eugenio Oneguin; retrato de Márkov y portada de 1825. |
| Simulador | `Simulator.tsx` | "Prueba una cartera" en tres estados: la cartera, tus ajustes (interactivo) y el resultado, explicado en lenguaje común y en pesos. |
| Módulos | `Modules.tsx` | Mosaico: qué calcula el motor, lo implementado, lo próximo y fotografías de archivo. |
| Etapas | `Pipeline.tsx` | Barra proporcional a la duración medida de cada etapa de una solicitud. |
| Preguntas | `Questions.tsx` | Seis preguntas con su respuesta siempre visible. |
| Pie | `SiteFooter.tsx` | Enlaces, código, créditos de imágenes y nombre a todo el ancho; se descubre al final del scroll. |

`RevealOnScroll.tsx` agrega las entradas al hacer scroll. Sin JavaScript, o con `prefers-reduced-motion`, todo el contenido se muestra sin animación.

## Simulador del navegador

`frontend/lib/simulation.ts` replica el modelo de `backend/src/domain/simulation.jl`:

```text
μ_p = Σ w_i μ_i        σ_p = sqrt(Σ_i Σ_j w_i w_j ρ_ij σ_i σ_j)
resultado = Π (1 + μ_p + σ_p · z_t) - 1,   z_t ~ N(0, 1)
VaR = -cuantil_(1-confianza)      CVaR = -media de los resultados ≤ ese cuantil
```

- Los cuantiles usan interpolación lineal (tipo 7), igual que el backend.
- El generador aleatorio es mulberry32 con Box-Muller; la distribución coincide con la del motor, pero los escenarios uno a uno no, porque Julia usa Xoshiro.
- El botón se desactiva si los pesos no suman 100 %, la misma regla que valida `Portfolio` (RF-29), o si el monto no es mayor que cero.

### Lenguaje para cualquier visitante

El simulador está escrito para alguien sin formación financiera. Cada término técnico aparece primero como respuesta en lenguaje común y después, en chico, con su nombre técnico, para que el proyecto siga sirviendo para aprender:

| Lo que ve el visitante | Término técnico |
|---|---|
| "Lo más probable: terminas con $X" | Mediana (percentil 50) |
| "Probabilidad de ganar: N de cada 100 futuros" | Fracción de escenarios con resultado positivo (`probabilityOfGain`) |
| "En los mejores casos (1 de cada 20): ganas $X o más" | Percentil 95 |
| "Casi siempre (N−1 de cada N futuros): pierdes menos de $X" | VaR al nivel de confianza |
| "En el peor 1 de cada N: pierdes $X en promedio" | CVaR (pérdida esperada en la cola) |
| "Peores casos a medir: 1 de cada 10 / 20 / 100" | Confianza 90 % / 95 % / 99 % |
| "Plazo" | Horizonte |
| "Número de prueba (semilla)" | Semilla del generador aleatorio |
| "Gana al año" / "Cuánto varía" | Rendimiento anual / volatilidad |

- **Monto a invertir (MXN):** por defecto `DEFAULT_CAPITAL = 10,000` (`lib/landing-data.ts`). Solo traduce los porcentajes a pesos; el modelo no cambia. Acepta decimales (`step="any"`).
- El resultado se divide en dos grupos, "Lo que podrías ganar" y "Lo que podrías perder".
- El VaR se presenta como un **límite** ("pierdes menos de"), no como pérdida máxima: el CVaR promedia los futuros que superan ese límite y por eso siempre es mayor. Decir "podrías perder hasta" para el VaR contradecía al CVaR y se corrigió.
- Si incluso el peor caso termina en ganancia (VaR negativo), los textos cambian a "Ganas al menos $X".
- El histograma explica qué representa cada barra y cuáles son los peores casos (en azul claro).
- El servidor calcula el primer resultado (`lib/demo.ts`), así que la sección muestra datos reales aunque el navegador no ejecute JavaScript.

### Datos de ejemplo

`frontend/lib/landing-data.ts` define la cartera de demostración: AAPL, MSFT, JPM y XOM con rendimiento y volatilidad anuales redondeados y una matriz de correlación elegida a mano. **No son datos de mercado**, y la página lo dice. Cuando la API esté desplegada, el simulador puede llamar a `POST /api/risk/monte-carlo` (ver [`API.md`](API.md)) con precios reales.

### Mediciones de la sección de etapas

`REQUEST_STAGES` contiene la mediana de 30 ejecuciones en el motor Julia de una solicitud con 4 activos, 253 precios, 10,000 escenarios y 21 días:

| Etapa | Tiempo |
|---|---|
| Leer el JSON y validar | 0.12 ms |
| Rendimientos y covarianza | 0.03 ms |
| Simulación | 0.66 ms |
| Resumen (ordenar, percentiles, VaR, CVaR) | 2.31 ms |
| Solicitud completa | 3.0 ms |

Si el backend cambia (por ejemplo, ordenar una sola vez en `summarize_outcomes`), conviene volver a medir y actualizar estos valores.

## Imágenes

Todas están en `frontend/public/archive/`, en escala de grises y con brillo reducido vía CSS (`grayscale(1) contrast(1.05) brightness(0.82)`) para que no destaquen sobre el fondo oscuro, con su crédito en el pie y en `public/archive/credits.json`:

| Archivo | Imagen | Licencia |
|---|---|---|
| `andrei-markov.jpg` | Retrato de Andréi Márkov, 1886 | Dominio público |
| `evgeny-onegin-cover-1825.jpg` | Portada de Eugenio Oneguin, 1825 | Dominio público |
| `reprogramming-eniac.jpg` | Reprogramación de la ENIAC, 1946, U.S. Army | Dominio público |
| `la-bourse-paris-annee-1900.jpg` | Bolsa de París hacia 1900, Ladislav Luppa | CC BY-SA 3.0 (crédito obligatorio) |
| `automatic-ticker-apparatus-new-york-stock-exchange.jpg` | Teletipos de la Bolsa de Nueva York, Library of Congress | Dominio público |

Fuente de todas: Wikimedia Commons. Las imágenes muestran el contexto histórico del método; ninguna se presenta como parte del producto.

## Formato de números

Se usa la convención de México: coma para miles y punto para decimales (`10,000`, `6.1 %`). Los porcentajes del simulador se formatean con `toLocaleString("es-MX")`.

## Verificación

```bash
cd frontend
npm run typecheck
npm run build
```

El 2026-10-22 se hizo una pasada de pulido con la skill `impeccable` (layout y polish), enfocada en dimensiones:

- La escala de tipo pasó de 14/21/26/64/141 px a 15/18/24/56/96 px, con saltos parejos.
- Los bordes izquierdos del texto pasaron de seis a tres ejes.
- El gráfico de la portada ocupa el ancho completo; sus etiquetas están en HTML, así que siguen legibles en el teléfono.
- Bajo 1100 px la barra de etapas pasa a vertical para que su texto no se superponga.
- La página bajó de unos 8,500 a 8,100 px de alto en escritorio.
- Ajustes posteriores del mismo día: el alto del gráfico de portada crece con el ancho de la pantalla (`clamp(240px, 34vw, 760px)`) para mantener una proporción cercana a 2.8:1 y no aplastarse en pantallas anchas; se probó un ancho máximo de 1600 px, pero dejaba franjas vacías a los costados y se descartó. Título de portada más grande (hasta 144 px), el dato de 3 ms junto al título y una barra de navegación con más presencia ("Lab" en aciano, enlaces de 18 px y botón "Ver el código" hacia el repositorio, que se oculta bajo 1100 px).
- Ese botón pasó a ser **"Entrar"** y lleva a `/login`, la puerta de entrada a la aplicación; el enlace al repositorio sigue en el pie. Bajo 1100 px, "Entrar" aparece como enlace junto al logo.

Durante el rediseño se verificó además, con la skill `design-taste-frontend`:

- `lint.mjs` sobre `app`, `components` y `lib`: 0 FAIL, 0 WARN.
- `inspect.mjs` sobre el build de producción a 1440, 768 y 390 px: 0 FAIL, 1 WARN (sin video; el único clip de archivo disponible pesaba 77 MB).
- En un navegador real: pesos inválidos desactivan el botón, la misma semilla repite el resultado y todas las entradas animadas aparecen.

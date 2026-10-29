# Utilidades del frontend (`frontend/lib`)

## Overview
Lógica compartida que da soporte a la interfaz (`frontend/lib`). Incluye la versión para el navegador del modelo Monte Carlo del backend (`normal-rebalanced-v1`), la ejecución de la cartera de demostración tanto en el primer render del servidor como en el simulador interactivo, los textos y mediciones de referencia de la página de inicio, y la configuración de autenticación con Google mediante Auth.js (`next-auth` v4) sincronizada con el backend Julia.

Ver [`LANDING.md`](../../documentacion/tecnica/LANDING.md). El único llamado a la API Julia por ahora es el de `auth.ts`; el contrato está en [`API.md`](../../documentacion/tecnica/API.md).

## Interface
- `[auth.ts:authOptions]`: Configuración `NextAuthOptions` con `GoogleProvider`, estrategia de sesión `"jwt"`, páginas `/login` y callbacks `signIn`, `jwt` y `session`.
- `[auth.ts:getSession]`: Helper de servidor que devuelve `getServerSession(authOptions)`.
- `[demo.ts:DemoResult]`: Tipo que combina el resultado de `runSimulation` con `request: SimulationRequest` y `elapsedMs: number | null`.
- `[demo.ts:runDemo]`: Ejecuta la cartera de demostración (`SAMPLE_ASSETS`, `SAMPLE_CORRELATION`) para el primer render en servidor y bajo demanda en el navegador.
- `[landing-data.ts:SAMPLE_ASSETS]`: Activos ilustrativos de la cartera de demostración (`AAPL`, `MSFT`, `JPM`, `XOM`).
- `[landing-data.ts:SAMPLE_CORRELATION]`: Matriz de correlación 4×4 definida positiva de la cartera de ejemplo.
- `[landing-data.ts:DEFAULT_REQUEST]`: Parámetros por defecto del simulador (`weights: [32, 28, 22, 18]`, `horizon: 21`, `simulations: 10_000`, `seed: 42`, `confidence: 0.95`).
- `[landing-data.ts:DEFAULT_CAPITAL]`: Monto base de ejemplo (`10_000` MXN) para traducir porcentajes a dinero.
- `[landing-data.ts:HORIZON_OPTIONS]`: Opciones de horizonte temporal (`1`, `5`, `21`, `63` y `252` días).
- `[landing-data.ts:NAV_LINKS]`, `[landing-data.ts:FACTS]`, `[landing-data.ts:REQUEST_STAGES]`, `[landing-data.ts:IMPLEMENTED_METRICS]`, `[landing-data.ts:QUESTIONS]`, `[landing-data.ts:REPOSITORY_URL]`: Datos editoriales, enlaces, preguntas frecuentes y tiempos medidos en el motor Julia para la portada.
- `[simulation.ts:TRADING_DAYS]`: Constante de días hábiles anuales (`252`).
- `[simulation.ts:SUMMARY_PERCENTILES]`: Percentiles calculados en el resumen (`[1, 5, 25, 50, 75, 95, 99]`).
- `[simulation.ts:SampleAsset]`, `[simulation.ts:SimulationSummary]`, `[simulation.ts:SimulationRequest]`: Tipos de entrada y salida del simulador Monte Carlo.
- `[simulation.ts:mulberry32]`, `[simulation.ts:normalGenerator]`: Generadores pseudoaleatorios deterministas con semilla (`mulberry32` + transformación de Box-Muller).
- `[simulation.ts:portfolioMoments]`: Calcula la media (`mu`) y volatilidad (`sigma`) diarias de la cartera a partir de cifras anuales y matriz de correlación.
- `[simulation.ts:simulateOutcomes]`: Simula escenarios de rendimiento acumulado capitalizando `horizon` períodos (`normal-rebalanced-v1`).
- `[simulation.ts:quantileSorted]`: Calcula cuantiles por interpolación lineal (tipo 7 de Hyndman y Fan) sobre un `Float64Array` ordenado.
- `[simulation.ts:summarize]`: Resume los escenarios simulados con media, extremos, percentiles, `valueAtRisk`, `conditionalValueAtRisk` y `probabilityOfGain`.\n- `[simulation.ts:histogram]`: Agrupa los escenarios ordenados en intervalos uniformes (`{ low, high, width, counts }`).
- `[simulation.ts:runSimulation]`: Ejecuta el flujo completo de simulación en navegador con histograma de 36 barras.
- `[simulation.ts:samplePaths]`: Genera trayectorias de valor (iniciando en `1`) para el gráfico de la portada.

## Invariants
- `[auth.ts:server-only]`: `auth.ts` importa `"server-only"` y solo puede importarse desde componentes o rutas de servidor.
- `[auth.ts:signIn]`: Solo se inicia sesión si `account?.provider === "google"`, el perfil de Google incluye `sub`, `email` y `email_verified === true`, y `syncUser` confirma el guardado en el backend (`saved !== null`), evitando sesiones de usuarios inexistentes en PostgreSQL.
- `[auth.ts:BACKEND_TIMEOUT_MS]`: El llamado interno al backend tiene un tiempo límite estricto de `5_000` ms (`AbortSignal.timeout(BACKEND_TIMEOUT_MS)`).
- `[simulation.ts:portfolioMoments]`: Escala rendimientos anuales con `TRADING_DAYS = 252` y volatilidades con `Math.sqrt(252)`, acotando la varianza con `Math.max(variance, 0)`.
- `[simulation.ts:quantileSorted]`: Requiere que el arreglo `sorted` esté ordenado de menor a mayor; utiliza interpolación lineal tipo 7 de Hyndman y Fan.
- `[simulation.ts:summarize]`: `valueAtRisk` (`-threshold`) y `conditionalValueAtRisk` (`-(tailSum / tailCount)`) se expresan como pérdidas positivas para el nivel `1 - confidence`.
- `[simulation.ts:runSimulation]`: Espera `request.weights` en puntos porcentuales (`0..100`), los normaliza dividiendo entre `100` y construye siempre un histograma de `36` intervalos.

## Side Effects
- `[auth.ts:syncUser]`: Lee `process.env.BACKEND_URL` y `process.env.INTERNAL_API_KEY`, realiza una solicitud `POST ${BACKEND_URL}/api/internal/users/google` sin caché (`cache: "no-store"`) con el encabezado `X-Internal-Key` y registra fallos con `console.error`.
- `[auth.ts:authOptions]`: Lee `process.env.GOOGLE_CLIENT_ID` y `process.env.GOOGLE_CLIENT_SECRET`, y muta `user`, `token.userId` y `session.user.id` durante el ciclo de callbacks de Auth.js.

## Verification
- Run: `npm run typecheck && npm run build`

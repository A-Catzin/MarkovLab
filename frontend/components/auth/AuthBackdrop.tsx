import { DEFAULT_REQUEST, SAMPLE_ASSETS, SAMPLE_CORRELATION } from "@/lib/landing-data";
import { TRADING_DAYS, portfolioMoments, samplePaths } from "@/lib/simulation";

const WIDTH = 1200;
const HEIGHT = 600;
const PATHS = 48;
const SEED = 7;
// Trayectorias que recorre el pulso de luz, de una en una y en ciclo (ver .trace-pulse en globals.css).
const PULSES = 6;
const Y_MIN = 0.65;
const Y_MAX = 1.75;

const x = (t: number) => (t / TRADING_DAYS) * WIDTH;
const y = (value: number) =>
  HEIGHT - ((Math.min(Y_MAX, Math.max(Y_MIN, value)) - Y_MIN) / (Y_MAX - Y_MIN)) * HEIGHT;
const toPath = (points: number[]) =>
  points.map((v, t) => `${t === 0 ? "M" : "L"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join("");

/** Percentil `p` de cada día, a partir de un conjunto de trayectorias. */
function percentileLine(paths: number[][], p: number) {
  return Array.from({ length: TRADING_DAYS + 1 }, (_, t) => {
    const column = paths.map((path) => path[t]).sort((a, b) => a - b);
    return column[Math.round((column.length - 1) * p)];
  });
}

/**
 * Fondo de la pantalla de acceso: un abanico de trayectorias Monte Carlo de la cartera de
 * ejemplo (las mismas cifras que la landing, con otra semilla) que se dibuja al entrar,
 * de izquierda a derecha, con las bandas del percentil 5 y 95 en el color de acento.
 * Después, un pulso de luz recorre las trayectorias de una en una, en ciclo: la simulación sigue corriendo.
 * Se calcula en el servidor y es decorativo: los lectores de pantalla lo ignoran.
 */
export function AuthBackdrop() {
  const weights = DEFAULT_REQUEST.weights.map((w) => w / 100);
  const { mu, sigma } = portfolioMoments(SAMPLE_ASSETS, SAMPLE_CORRELATION, weights);
  const paths = samplePaths(mu, sigma, TRADING_DAYS, PATHS, SEED);
  const band = samplePaths(mu, sigma, TRADING_DAYS, 1000, SEED + 1);

  return (
    <svg
      className="auth__backdrop"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((path, i) => (
        <path
          key={i}
          d={toPath(path)}
          pathLength={1}
          data-draw
          style={{ ["--i" as string]: i }}
          fill="none"
          stroke="var(--ink)"
          strokeOpacity={0.13}
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {paths.slice(0, PULSES).map((path, i) => (
        <path
          key={`pulse-${i}`}
          d={toPath(path)}
          pathLength={1}
          className={i === 0 ? "trace-pulse trace-pulse--accent" : "trace-pulse"}
          style={{ ["--i" as string]: i }}
          fill="none"
          strokeWidth={i === 0 ? 2.4 : 1.8}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {[0.05, 0.95].map((p) => (
        <path
          key={p}
          d={toPath(percentileLine(band, p))}
          pathLength={1}
          data-draw
          className="auth__band"
          style={{ ["--i" as string]: PATHS }}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity={0.55}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

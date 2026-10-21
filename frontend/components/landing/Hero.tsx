import { DEFAULT_REQUEST, NAV_LINKS, SAMPLE_ASSETS, SAMPLE_CORRELATION } from "@/lib/landing-data";
import { TRADING_DAYS, portfolioMoments, samplePaths } from "@/lib/simulation";

const WIDTH = 900;
const HEIGHT = 420;
const SHOWN_PATHS = 60;
const BAND_PATHS = 2000;
const Y_MIN = 0.7;
const Y_MAX = 1.7;

function x(t: number) {
  return (t / TRADING_DAYS) * WIDTH;
}

function y(value: number) {
  const clamped = Math.min(Y_MAX, Math.max(Y_MIN, value));
  return HEIGHT - ((clamped - Y_MIN) / (Y_MAX - Y_MIN)) * HEIGHT;
}

function toPath(points: number[]) {
  return points.map((v, t) => `${t === 0 ? "M" : "L"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join("");
}

function percentileLine(paths: number[][], p: number) {
  return Array.from({ length: TRADING_DAYS + 1 }, (_, t) => {
    const column = paths.map((path) => path[t]).sort((a, b) => a - b);
    return column[Math.round((column.length - 1) * p)];
  });
}

export function Hero() {
  const weights = DEFAULT_REQUEST.weights.map((w) => w / 100);
  const { mu, sigma } = portfolioMoments(SAMPLE_ASSETS, SAMPLE_CORRELATION, weights);
  const shown = samplePaths(mu, sigma, TRADING_DAYS, SHOWN_PATHS, DEFAULT_REQUEST.seed);
  const band = samplePaths(mu, sigma, TRADING_DAYS, BAND_PATHS, DEFAULT_REQUEST.seed + 1);
  const low = percentileLine(band, 0.05);
  const median = percentileLine(band, 0.5);
  const high = percentileLine(band, 0.95);
  const ticks = [0.8, 1.2, 1.6];

  return (
    <header className="hero grid">
      <div className="hero__side">
        <div className="hero__top">
          <a className="wordmark" href="#top" id="top">
            MarkovLab
          </a>
          <a className="link hero__menu" href="#simulador">
            Simulador
          </a>
        </div>
        <div className="hero__talk">
          <p data-load style={{ ["--i" as string]: 0 }}>
            Un laboratorio académico que mide el riesgo de una cartera con 10,000 escenarios Monte Carlo
            reproducibles.
          </p>
          <a className="button" href="#simulador" data-load style={{ ["--i" as string]: 1 }}>
            Probar el simulador
          </a>
        </div>
      </div>

      <div className="hero__main">
        <nav className="hero__nav" aria-label="Secciones">
          <ul>
            {NAV_LINKS.map((item) => (
              <li key={item.href}>
                <a className="link" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <h1 className="lines" aria-label="Simula tu cartera">
          <span className="line" aria-hidden="true">
            <span data-line style={{ ["--i" as string]: 0 }}>
              Simula tu
            </span>
          </span>
          <span className="line" aria-hidden="true">
            <span data-line style={{ ["--i" as string]: 1 }}>
              cartera
            </span>
          </span>
        </h1>
      </div>

      <div className="hero__figure">
        <div className="accent-block">
          <strong>3 ms</strong>
          <p>10,000 escenarios a 21 días, de la solicitud a la respuesta, medidos en el motor Julia.</p>
        </div>
        <figure className="fan" data-ui>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Trayectorias simuladas del valor de la cartera durante 252 días, con las bandas del percentil 5 y 95">
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={0} x2={WIDTH} y1={y(tick)} y2={y(tick)} stroke="var(--surface-2)" strokeWidth={1} />
                <text x={4} y={y(tick) - 6} fill="var(--muted)" fontSize={14}>
                  {tick.toFixed(1)}×
                </text>
              </g>
            ))}
            {shown.map((path, i) => (
              <path
                key={i}
                d={toPath(path)}
                data-path
                style={{ ["--i" as string]: i }}
                fill="none"
                stroke="var(--ink)"
                strokeOpacity={0.22}
                strokeWidth={1.2}
              />
            ))}
            <path d={toPath(low)} fill="none" stroke="var(--accent)" strokeWidth={3} />
            <path d={toPath(median)} fill="none" stroke="var(--accent)" strokeWidth={3} strokeDasharray="10 8" />
            <path d={toPath(high)} fill="none" stroke="var(--accent)" strokeWidth={3} />
            <text x={WIDTH - 8} y={y(high[TRADING_DAYS]) - 10} textAnchor="end" fill="var(--ink)" fontSize={15}>
              Percentil 95
            </text>
            <text x={WIDTH - 8} y={y(low[TRADING_DAYS]) + 22} textAnchor="end" fill="var(--ink)" fontSize={15}>
              Percentil 5
            </text>
          </svg>
          <div className="fan__axis">
            <span>Hoy</span>
            <span>6 meses</span>
            <span>1 año, 252 días hábiles</span>
          </div>
          <figcaption className="fan__head">
            <span>Cartera de ejemplo: 60 de 10,000 trayectorias a un año</span>
            <span>Semilla 42</span>
          </figcaption>
        </figure>
      </div>
    </header>
  );
}

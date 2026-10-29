import Link from "next/link";
import { Coin } from "@/components/brand/Coin";
import { LogoMark } from "@/components/brand/LogoMark";
import { DEFAULT_REQUEST, NAV_LINKS, SAMPLE_ASSETS, SAMPLE_CORRELATION } from "@/lib/landing-data";
import { TRADING_DAYS, portfolioMoments, samplePaths } from "@/lib/simulation";

const WIDTH = 1300;
const HEIGHT = 420;
const SHOWN_PATHS = 60;
// Trayectorias que recorre el pulso de luz, de una en una y en ciclo (ver .trace-pulse en globals.css).
const PULSES = 6;
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
            <LogoMark className="wordmark__mark" />
            <span>
              Markov<span className="wordmark__accent">Lab</span>
            </span>
          </a>
          <Link className="link hero__menu" href="/login">
            Entrar
          </Link>
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
          <Link className="button button--small" href="/login">
            Entrar
          </Link>
        </nav>
        <div className="hero__headline">
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
        <div className="accent-block" data-load style={{ ["--i" as string]: 2 }}>
          <strong>3 ms</strong>
          <p>10,000 escenarios a 21 días, de la solicitud a la respuesta, medidos en el motor Julia.</p>
        </div>
        </div>
      </div>

      <div className="hero__coin" data-load style={{ ["--i" as string]: 3 }}>
        <Coin className="hero__coin-canvas" />
      </div>

      <div className="hero__figure">
        <figure className="fan" data-ui>
          {/* Las curvas se estiran a la altura de cada pantalla con trazo de grosor fijo;
              las etiquetas van en HTML para conservar su tamaño de texto. */}
          <div className="fan__plot">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Trayectorias simuladas del valor de la cartera durante 252 días, con las bandas del percentil 5 y 95"
            >
              {ticks.map((tick) => (
                <line
                  key={tick}
                  x1={0}
                  x2={WIDTH}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="var(--surface-2)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
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
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {/* Un pulso de luz a la vez sobre estas trayectorias: la simulación sigue corriendo. */}
              {shown.slice(0, PULSES).map((path, i) => (
                <path
                  key={`pulse-${i}`}
                  d={toPath(path)}
                  pathLength={1}
                  className={i === 0 ? "trace-pulse trace-pulse--accent" : "trace-pulse"}
                  style={{ ["--i" as string]: i, ["--start" as string]: "2000ms" }}
                  fill="none"
                  strokeWidth={i === 0 ? 3.2 : 2.6}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path d={toPath(low)} fill="none" stroke="var(--accent)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
              <path
                d={toPath(median)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={3}
                strokeDasharray="10 8"
                vectorEffect="non-scaling-stroke"
              />
              <path d={toPath(high)} fill="none" stroke="var(--accent)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            </svg>
            {ticks.map((tick) => (
              <span key={tick} className="fan__tick" style={{ top: `${(y(tick) / HEIGHT) * 100}%` }} aria-hidden="true">
                {tick.toFixed(1)}×
              </span>
            ))}
            <span className="fan__label fan__label--high" style={{ top: `${(y(high[TRADING_DAYS]) / HEIGHT) * 100}%` }}>
              Percentil 95
            </span>
            <span className="fan__label fan__label--low" style={{ top: `${(y(low[TRADING_DAYS]) / HEIGHT) * 100}%` }}>
              Percentil 5
            </span>
          </div>
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

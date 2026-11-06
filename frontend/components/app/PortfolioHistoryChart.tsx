"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";

/** Un punto de la historia: fecha ISO y valor de la cartera ese día. */
export type HistoryPoint = [string, number];

interface Props {
  points: HistoryPoint[];
  /** Día en que se creó la cartera: ahí vale el capital y se dibuja la línea vertical. */
  anchorDate: string;
  capital: number;
  currency: string;
}

const RANGES = [
  { id: "1y", label: "1A", years: 1 },
  { id: "5y", label: "5A", years: 5 },
  { id: "10y", label: "10A", years: 10 },
  { id: "all", label: "Todo", years: null },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

// El SVG mide el ancho real de su contenedor, así el texto conserva su tamaño en el teléfono.
const DEFAULT_WIDTH = 720;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };
// Puntos dibujados como máximo: más que eso no se distingue y vuelve pesada la línea.
const MAX_DRAWN = 600;

const money = (value: number, currency: string) =>
  `${value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
// Etiquetas del eje: completas hasta 10,000 y abreviadas después ("25 k", "1.2 M"), todas con el mismo formato.
const axisLabel = (value: number, max: number) =>
  max >= 10_000
    ? value.toLocaleString("es-MX", {
        notation: "compact",
        maximumFractionDigits: 1,
      })
    : value.toLocaleString("es-MX", { maximumFractionDigits: 0 });
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const percent = (value: number) =>
  `${value > 0 ? "+" : ""}${(value * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })} %`;

/** Recorta la serie al rango elegido, contado hacia atrás desde el último día. */
function slice(points: HistoryPoint[], years: number | null) {
  if (years === null || points.length === 0) return points;
  const last = new Date(`${points[points.length - 1][0]}T00:00:00Z`);
  last.setUTCFullYear(last.getUTCFullYear() - years);
  const from = last.toISOString().slice(0, 10);
  const sliced = points.filter(([date]) => date >= from);
  return sliced.length >= 2 ? sliced : points;
}

/** Toma puntos parejos para dibujar, conservando siempre el primero y el último. */
function thin(points: HistoryPoint[]) {
  if (points.length <= MAX_DRAWN) return points;
  const step = (points.length - 1) / (MAX_DRAWN - 1);
  return Array.from(
    { length: MAX_DRAWN },
    (_, i) => points[Math.round(i * step)],
  );
}

/** Cuatro marcas "redondas" para el eje vertical. */
function niceTicks(min: number, max: number) {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step / 1e6; v += step)
    ticks.push(v);
  return ticks;
}

/**
 * Valor histórico de una cartera de comprar y mantener: cuánto habría valido con estos pesos
 * y cuánto vale desde que se creó. La línea vertical marca ese día; la horizontal, el capital.
 */
export function PortfolioHistoryChart({
  points,
  anchorDate,
  capital,
  currency,
}: Props) {
  const [range, setRange] = useState<RangeId>("5y");
  const [active, setActive] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [WIDTH, setWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, Math.round(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const HEIGHT = WIDTH < 520 ? 220 : 280;

  const visible = useMemo(
    () => slice(points, RANGES.find((r) => r.id === range)!.years),
    [points, range],
  );
  const drawn = useMemo(() => thin(visible), [visible]);

  const values = drawn.map(([, v]) => v);
  const min = Math.min(...values, capital);
  const max = Math.max(...values, capital);
  const pad = (max - min) * 0.06 || 1;
  const yMin = min - pad;
  const yMax = max + pad;
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (drawn.length === 1 ? 0 : (i / (drawn.length - 1)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const line = drawn
    .map(
      ([, v], i) =>
        `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`,
    )
    .join("");
  const area = `${line}L${x(drawn.length - 1).toFixed(1)},${PAD.top + plotH}L${PAD.left},${PAD.top + plotH}Z`;

  // El ancla solo se dibuja si cae dentro del rango visible.
  const anchorIndex = drawn.findIndex(([date]) => date >= anchorDate);
  const showAnchor =
    anchorDate >= drawn[0][0] &&
    anchorDate <= drawn[drawn.length - 1][0] &&
    anchorIndex >= 0;
  const anchorX = showAnchor ? x(anchorIndex) : 0;
  const anchorLabelLeft = anchorX > PAD.left + plotW * 0.7;

  // Marcas del eje horizontal: el primer día de cada año (o cada pocos años) del rango.
  const years = [...new Set(drawn.map(([date]) => date.slice(0, 4)))];
  const maxTicks = Math.max(2, Math.floor(plotW / 72));
  const everyYears = Math.max(1, Math.ceil(years.length / maxTicks));
  const xTicks = years
    .filter((_, i) => i % everyYears === 0)
    .map((year) => ({
      year,
      index: drawn.findIndex(([date]) => date.startsWith(year)),
    }))
    .filter(({ index }) => index > 0 || drawn.length < 40);

  const first = visible[0];
  const last = visible[visible.length - 1];
  const change = last[1] / first[1] - 1;
  const hovered = active === null ? null : drawn[active];

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActive(
      Math.max(
        0,
        Math.min(drawn.length - 1, Math.round(ratio * (drawn.length - 1))),
      ),
    );
  };
  const step = (event: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -Infinity,
      End: Infinity,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const current = active ?? drawn.length - 1;
    setActive(
      Math.max(0, Math.min(drawn.length - 1, current + moves[event.key])),
    );
  };

  // Tabla accesible: el último valor de cada mes del rango.
  const monthly = useMemo(() => {
    const byMonth = new Map<string, HistoryPoint>();
    for (const point of visible) byMonth.set(point[0].slice(0, 7), point);
    return [...byMonth.values()].reverse();
  }, [visible]);

  return (
    <section className="panel ph" aria-labelledby="history-title">
      <div className="ph__head">
        <div>
          <h2 id="history-title">Valor histórico</h2>
          <p className="panel__help">
            Cuánto habría valido la cartera si la hubieras comprado antes con
            estos pesos y no la movieras. La línea vertical marca el día en que
            la creaste y la horizontal, tu capital.
          </p>
        </div>
        <div className="ph__ranges" role="group" aria-label="Periodo">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className="ph__range"
              aria-pressed={range === r.id}
              onClick={() => {
                setRange(r.id);
                setActive(null);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <p className="ph__summary" aria-live="polite">
        <strong>{money(hovered ? hovered[1] : last[1], currency)}</strong>
        <span className="ph__meta">
          {hovered
            ? longDate(hovered[0])
            : `${percent(change)} desde ${longDate(first[0])}`}
        </span>
      </p>

      <div ref={frame} className="ph__frame">
        <svg
          className="ph__chart"
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Valor de la cartera del ${longDate(first[0])} al ${longDate(last[0])}: de ${money(first[1], currency)} a ${money(last[1], currency)}.`}
          tabIndex={0}
          onKeyDown={step}
          onBlur={() => setActive(null)}
        >
          <defs>
            <linearGradient id="ph-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {niceTicks(yMin, yMax).map((tick) => (
            <g key={tick}>
              <line
                className="ph__grid"
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text
                className="ph__axis"
                x={PAD.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {axisLabel(tick, yMax)}
              </text>
            </g>
          ))}
          {xTicks.map(({ year, index }) => (
            <text
              key={year}
              className="ph__axis"
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
            >
              {year}
            </text>
          ))}

          {/* Capital inicial: la referencia contra la que se gana o se pierde. */}
          <line
            className="ph__capital"
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(capital)}
            y2={y(capital)}
          />

          <path d={area} fill="url(#ph-fill)" />
          <path className="ph__line" d={line} />

          {showAnchor && (
            <g className="ph__anchor">
              <line
                x1={anchorX}
                x2={anchorX}
                y1={PAD.top}
                y2={PAD.top + plotH}
              />
              <circle cx={anchorX} cy={y(drawn[anchorIndex][1])} r={4} />
              <text
                x={anchorLabelLeft ? anchorX - 8 : anchorX + 8}
                y={PAD.top + 12}
                textAnchor={anchorLabelLeft ? "end" : "start"}
              >
                Creaste la cartera
              </text>
            </g>
          )}

          {hovered && active !== null && (
            <g className="ph__cursor" aria-hidden="true">
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + plotH}
              />
              <circle cx={x(active)} cy={y(hovered[1])} r={4} />
            </g>
          )}

          <rect
            className="ph__hit"
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      </div>

      <p className="ph__note">
        Precios de cierre ajustados, sin rebalanceo y sin conversión de moneda:
        cada activo rinde en la suya.
      </p>

      <details className="ph__table">
        <summary>Ver los datos por mes</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col" className="num">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {monthly.map(([date, value]) => (
                <tr key={date}>
                  <td>{longDate(date)}</td>
                  <td className="num">{money(value, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

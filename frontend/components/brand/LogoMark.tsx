/**
 * Símbolo de MarkovLab ("M recorrida"): una distribución de dos picos que forma la M,
 * con nueve estados repartidos a la misma distancia sobre la curva. El primero, en
 * color de acento, es el estado inicial del recorrido. El trazo usa `currentColor`.
 */

// Densidad bimodal escalada al lienzo de 64 × 64; los picos quedan en x = 19 y x = 45.
function curveY(x: number) {
  const bump = (mu: number) => Math.exp(-(((x - mu) / 6.5) ** 2) / 2);
  return 52 - 38 * (bump(19) + bump(45));
}

const CURVE_POINTS = Array.from({ length: 105 }, (_, i) => {
  const x = 6 + i * 0.5;
  return `${x},${curveY(x).toFixed(1)}`;
}).join(" ");

// Posiciones x con igual longitud de arco entre estados (calculadas una vez; ver mis-docs/identidad).
const STATE_XS = [6, 11.9, 17.3, 25, 32, 39, 46.7, 52.1, 58];

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <line x1="4" y1="57" x2="60" y2="57" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <polyline
        points={CURVE_POINTS}
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {STATE_XS.map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={curveY(x).toFixed(1)}
          r={i === 0 ? 5 : 3.5}
          fill={i === 0 ? "var(--accent)" : "currentColor"}
        />
      ))}
    </svg>
  );
}

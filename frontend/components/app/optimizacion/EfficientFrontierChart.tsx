"use client";

import { type EfficientFrontierPoint } from "@/lib/optimizer";
import { formatPercent } from "@/lib/portfolios";

interface EfficientFrontierChartProps {
  points: EfficientFrontierPoint[];
  currentPoint?: { volatility: number; returnRate: number; name: string } | null;
  optimalPoint?: { volatility: number; returnRate: number; name: string } | null;
  assetPoints?: { ticker: string; volatility: number; returnRate: number }[];
}

export function EfficientFrontierChart({
  points,
  currentPoint,
  optimalPoint,
  assetPoints = [],
}: EfficientFrontierChartProps) {
  if (points.length < 2) return null;

  // Determinar límites del gráfico
  const allVols = [
    ...points.map((p) => p.volatility),
    ...(currentPoint ? [currentPoint.volatility] : []),
    ...(optimalPoint ? [optimalPoint.volatility] : []),
    ...assetPoints.map((a) => a.volatility),
  ];

  const allRets = [
    ...points.map((p) => p.returnRate),
    ...(currentPoint ? [currentPoint.returnRate] : []),
    ...(optimalPoint ? [optimalPoint.returnRate] : []),
    ...assetPoints.map((a) => a.returnRate),
  ];

  const minVol = Math.max(0.01, Math.min(...allVols) * 0.85);
  const maxVol = Math.max(...allVols) * 1.12;
  const minRet = Math.min(...allRets) * 0.85;
  const maxRet = Math.max(...allRets) * 1.12;

  const width = 640;
  const height = 320;
  const padLeft = 56;
  const padRight = 32;
  const padTop = 32;
  const padBottom = 48;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const scaleX = (vol: number) => padLeft + ((vol - minVol) / Math.max(maxVol - minVol, 1e-6)) * plotW;
  const scaleY = (ret: number) => height - padBottom - ((ret - minRet) / Math.max(maxRet - minRet, 1e-6)) * plotH;

  // Puntos de la curva de la frontera
  const pathD = points.reduce((acc, pt, i) => {
    const x = scaleX(pt.volatility);
    const y = scaleY(pt.returnRate);
    return i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, "");

  // Ejes y cuadrícula
  const xTicks = [minVol, (minVol + maxVol) / 2, maxVol];
  const yTicks = [minRet, (minRet + maxRet) / 2, maxRet];

  return (
    <div className="ui-panel frontier-panel" data-ui>
      <div className="ui-panel__top">
        <span className="ui-panel__name">Frontera Eficiente de Markowitz</span>
        <span className="ui-tag">Modelo Media-Varianza</span>
      </div>

      <p className="ui-note">
        La curva azul representa las carteras óptimas que ofrecen el máximo rendimiento para cada
        nivel de volatilidad. Los puntos bajo la curva asumen más riesgo del necesario.
      </p>

      <div className="frontier-chart-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="frontier-chart"
          role="img"
          aria-label="Gráfico de la Frontera Eficiente de Markowitz: rendimiento vs volatilidad"
        >
          {/* Líneas de cuadrícula horizontal */}
          {yTicks.map((yVal, i) => {
            const y = scaleY(yVal);
            return (
              <g key={`y-${i}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--surface-2)"
                  strokeDasharray="4 4"
                />
                <text
                  x={padLeft - 10}
                  y={y + 4}
                  fill="var(--muted)"
                  fontSize="11"
                  textAnchor="end"
                  fontFamily="inherit"
                >
                  {formatPercent(yVal, 0)}
                </text>
              </g>
            );
          })}

          {/* Líneas de cuadrícula vertical */}
          {xTicks.map((xVal, i) => {
            const x = scaleX(xVal);
            return (
              <g key={`x-${i}`}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={height - padBottom}
                  stroke="var(--surface-2)"
                  strokeDasharray="4 4"
                />
                <text
                  x={x}
                  y={height - padBottom + 18}
                  fill="var(--muted)"
                  fontSize="11"
                  textAnchor="middle"
                  fontFamily="inherit"
                >
                  ±{formatPercent(xVal, 0)}
                </text>
              </g>
            );
          })}

          {/* Etiquetas de los ejes */}
          <text
            x={width / 2}
            y={height - 10}
            fill="var(--muted)"
            fontSize="12"
            textAnchor="middle"
          >
            Volatilidad anual estimada (Riesgo σ)
          </text>
          <text
            x={-height / 2}
            y={16}
            fill="var(--muted)"
            fontSize="12"
            textAnchor="middle"
            transform="rotate(-90)"
          >
            Rendimiento anual (μ)
          </text>

          {/* Curva de la frontera eficiente */}
          <path
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Activos individuales */}
          {assetPoints.map((a) => {
            const x = scaleX(a.volatility);
            const y = scaleY(a.returnRate);
            return (
              <g key={a.ticker} className="frontier-asset-point">
                <circle cx={x} cy={y} r="4" fill="var(--field-strong)" stroke="var(--ink)" strokeWidth="1" />
                <text x={x + 6} y={y - 6} fill="var(--muted)" fontSize="10" fontWeight="600">
                  {a.ticker}
                </text>
              </g>
            );
          })}

          {/* Cartera actual (si existe) */}
          {currentPoint ? (
            <g className="frontier-point-current">
              <circle
                cx={scaleX(currentPoint.volatility)}
                cy={scaleY(currentPoint.returnRate)}
                r="7"
                fill="#38bdf8"
                stroke="#0a0d14"
                strokeWidth="2"
              />
              <text
                x={scaleX(currentPoint.volatility) + 10}
                y={scaleY(currentPoint.returnRate) + 4}
                fill="#38bdf8"
                fontSize="11"
                fontWeight="600"
              >
                Cartera actual
              </text>
            </g>
          ) : null}

          {/* Cartera óptima */}
          {optimalPoint ? (
            <g className="frontier-point-optimal">
              <circle
                cx={scaleX(optimalPoint.volatility)}
                cy={scaleY(optimalPoint.returnRate)}
                r="8"
                fill="var(--accent)"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
              <text
                x={scaleX(optimalPoint.volatility) + 12}
                y={scaleY(optimalPoint.returnRate) - 6}
                fill="var(--ink)"
                fontSize="12"
                fontWeight="700"
              >
                Cartera óptima
              </text>
            </g>
          ) : null}
        </svg>
      </div>

      <div className="frontier-legend">
        <span className="frontier-legend__item">
          <span className="frontier-legend__line" /> Frontera Eficiente
        </span>
        {optimalPoint ? (
          <span className="frontier-legend__item">
            <span className="frontier-legend__dot frontier-legend__dot--optimal" /> Asignación óptima
          </span>
        ) : null}
        {currentPoint ? (
          <span className="frontier-legend__item">
            <span className="frontier-legend__dot frontier-legend__dot--current" /> Tu cartera actual
          </span>
        ) : null}
        <span className="frontier-legend__item">
          <span className="frontier-legend__dot frontier-legend__dot--asset" /> Activos individuales
        </span>
      </div>
    </div>
  );
}

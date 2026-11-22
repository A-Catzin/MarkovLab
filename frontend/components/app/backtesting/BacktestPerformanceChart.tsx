"use client";

import { type BacktestSeriesPoint } from "@/lib/backtesting";
import { formatMoney, type Currency } from "@/lib/portfolios";

interface BacktestPerformanceChartProps {
  series: BacktestSeriesPoint[];
  portfolioName: string;
  benchmarkTicker: string;
  currency?: Currency;
}

export function BacktestPerformanceChart({
  series,
  portfolioName,
  benchmarkTicker,
  currency = "MXN",
}: BacktestPerformanceChartProps) {
  if (series.length < 2) return null;

  const width = 640;
  const height = 300;
  const padLeft = 70;
  const padRight = 32;
  const padTop = 24;
  const padBottom = 40;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const allValues = [
    ...series.map((p) => p.portfolioValue),
    ...series.map((p) => p.benchmarkValue),
  ];

  const minVal = Math.min(...allValues) * 0.95;
  const maxVal = Math.max(...allValues) * 1.05;

  const scaleX = (idx: number) => padLeft + (idx / (series.length - 1)) * plotW;
  const scaleY = (val: number) => height - padBottom - ((val - minVal) / Math.max(maxVal - minVal, 1e-6)) * plotH;

  // Path de la cartera
  const portPath = series.reduce((acc, pt, i) => {
    const x = scaleX(i);
    const y = scaleY(pt.portfolioValue);
    return i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, "");

  // Path del benchmark
  const benchPath = series.reduce((acc, pt, i) => {
    const x = scaleX(i);
    const y = scaleY(pt.benchmarkValue);
    return i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : `${acc} L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, "");

  // Y Ticks
  const yTicks = [minVal, (minVal + maxVal) / 2, maxVal];

  // X Ticks (fechas inicio, medio, fin)
  const xIndices = [0, Math.floor(series.length / 2), series.length - 1];

  return (
    <div className="ui-panel bt-chart-panel" data-ui>
      <div className="ui-panel__top">
        <span className="ui-panel__name">Evolución temporal del patrimonio</span>
        <span className="ui-tag">Trayectoria acumulada</span>
      </div>

      <div className="bt-chart-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="bt-chart"
          role="img"
          aria-label={`Evolución del patrimonio de ${portfolioName} contra ${benchmarkTicker}`}
        >
          {/* Líneas horizontales de cuadrícula */}
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
                  {formatMoney(yVal, currency)}
                </text>
              </g>
            );
          })}

          {/* Líneas verticales con fecha */}
          {xIndices.map((idx) => {
            const x = scaleX(idx);
            const dateStr = series[idx]?.date ?? "";
            return (
              <g key={`x-${idx}`}>
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
                  y={height - padBottom + 20}
                  fill="var(--muted)"
                  fontSize="11"
                  textAnchor={idx === 0 ? "start" : idx === series.length - 1 ? "end" : "middle"}
                  fontFamily="inherit"
                >
                  {dateStr}
                </text>
              </g>
            );
          })}

          {/* Línea del benchmark (discontinua) */}
          <path
            d={benchPath}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
          />

          {/* Línea de la cartera (aciano sólido) */}
          <path
            d={portPath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Puntos finales */}
          <circle
            cx={scaleX(series.length - 1)}
            cy={scaleY(series[series.length - 1].portfolioValue)}
            r="4.5"
            fill="var(--accent)"
            stroke="#ffffff"
            strokeWidth="1.5"
          />

          <circle
            cx={scaleX(series.length - 1)}
            cy={scaleY(series[series.length - 1].benchmarkValue)}
            r="3.5"
            fill="#94a3b8"
            stroke="#0a0d14"
            strokeWidth="1"
          />
        </svg>
      </div>

      <div className="bt-legend">
        <span className="bt-legend__item">
          <span className="bt-legend__line bt-legend__line--portfolio" />
          <strong>{portfolioName}</strong> (Tu cartera)
        </span>
        <span className="bt-legend__item">
          <span className="bt-legend__line bt-legend__line--benchmark" />
          <strong>{benchmarkTicker}</strong> (Índice de referencia)
        </span>
      </div>
    </div>
  );
}

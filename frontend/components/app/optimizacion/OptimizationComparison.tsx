"use client";

import Link from "next/link";
import { getAssetColor } from "@/lib/asset-meta";
import { type OptimizationResult } from "@/lib/optimizer";
import {
  type Portfolio,
  portfolioMetrics,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  getSampleAsset,
} from "@/lib/portfolios";

interface OptimizationComparisonProps {
  originalPortfolio: Portfolio;
  result: OptimizationResult;
  onSaveAsNewPortfolio: () => void;
  onSaveAsNewVersion: () => void;
  onSimulate: () => void;
}

export function OptimizationComparison({
  originalPortfolio,
  result,
  onSaveAsNewPortfolio,
  onSaveAsNewVersion,
  onSimulate,
}: OptimizationComparisonProps) {
  const originalMetrics = portfolioMetrics(originalPortfolio.assets);
  const optMetrics = result.metrics;

  const retDelta = originalMetrics
    ? optMetrics.annualReturn - originalMetrics.annualReturn
    : 0;
  const volDelta = originalMetrics
    ? optMetrics.annualVolatility - originalMetrics.annualVolatility
    : 0;
  const sharpeDelta = originalMetrics
    ? optMetrics.sharpeRatio - originalMetrics.sharpeRatio
    : 0;

  return (
    <section className="ui-panel opt-comparison" data-ui aria-labelledby="comp-title">
      <div className="ui-panel__top">
        <div>
          <h2 id="comp-title" className="ui-panel__name">
            Comparación: Cartera actual vs. Cartera óptima (RF-40)
          </h2>
          <span className="muted">
            Objetivo: {result.objective === "min_variance" ? "Mínima varianza" : "Máximo ratio de Sharpe"}
          </span>
        </div>
        <span className="ui-tag ui-tag--done">
          Optimizada en {Math.max(1, Math.round(result.elapsedMs))} ms
        </span>
      </div>

      {/* Tarjetas comparativas de métricas */}
      <div className="opt-comparison__metric-cards">
        <div className="ui-panel opt-metric-card">
          <span className="opt-metric-card__title">Rendimiento anual (μ)</span>
          <div className="opt-metric-card__values">
            <div>
              <small className="muted">Actual</small>
              <strong>{originalMetrics ? formatSignedPercent(originalMetrics.annualReturn) : "—"}</strong>
            </div>
            <span className="opt-metric-card__arrow">→</span>
            <div>
              <small className="muted">Óptimo</small>
              <strong className="opt-metric-card__val--optimal">
                {formatSignedPercent(optMetrics.annualReturn)}
              </strong>
            </div>
          </div>
          <span className={`opt-metric-card__delta ${retDelta >= 0 ? "opt-delta--pos" : "opt-delta--neg"}`}>
            {retDelta >= 0 ? "+" : ""}{formatPercent(retDelta)} diferencia
          </span>
        </div>

        <div className="ui-panel opt-metric-card">
          <span className="opt-metric-card__title">Volatilidad anual (σ)</span>
          <div className="opt-metric-card__values">
            <div>
              <small className="muted">Actual</small>
              <strong>{originalMetrics ? `±${formatPercent(originalMetrics.annualVolatility)}` : "—"}</strong>
            </div>
            <span className="opt-metric-card__arrow">→</span>
            <div>
              <small className="muted">Óptimo</small>
              <strong className="opt-metric-card__val--optimal">
                ±{formatPercent(optMetrics.annualVolatility)}
              </strong>
            </div>
          </div>
          <span className={`opt-metric-card__delta ${volDelta <= 0 ? "opt-delta--pos" : "opt-delta--neg"}`}>
            {volDelta <= 0 ? "" : "+"}{formatPercent(volDelta)} variación de riesgo
          </span>
        </div>

        <div className="ui-panel opt-metric-card">
          <span className="opt-metric-card__title">Ratio de Sharpe</span>
          <div className="opt-metric-card__values">
            <div>
              <small className="muted">Actual</small>
              <strong>{originalMetrics ? originalMetrics.sharpeRatio.toFixed(2) : "—"}</strong>
            </div>
            <span className="opt-metric-card__arrow">→</span>
            <div>
              <small className="muted">Óptimo</small>
              <strong className="opt-metric-card__val--optimal">
                {optMetrics.sharpeRatio.toFixed(2)}
              </strong>
            </div>
          </div>
          <span className={`opt-metric-card__delta ${sharpeDelta >= 0 ? "opt-delta--pos" : "opt-delta--neg"}`}>
            {sharpeDelta >= 0 ? "+" : ""}{sharpeDelta.toFixed(2)} puntos
          </span>
        </div>
      </div>

      {/* Barras de comparación visual */}
      <div className="opt-comparison__bars">
        <div className="opt-comparison__bar-group">
          <span className="opt-comparison__bar-label">Distribución actual</span>
          <div className="portfolio-bar">
            {originalPortfolio.assets
              .filter((a) => a.weight > 0)
              .map((asset, i) => (
                <div
                  key={asset.ticker}
                  className="portfolio-bar__segment"
                  style={{
                    width: `${asset.weight}%`,
                    backgroundColor: getAssetColor(asset.ticker, i),
                  }}
                  title={`${asset.ticker}: ${asset.weight} %`}
                />
              ))}
          </div>
        </div>

        <div className="opt-comparison__bar-group">
          <span className="opt-comparison__bar-label">Distribución óptima</span>
          <div className="portfolio-bar">
            {result.assets
              .filter((a) => a.weight > 0)
              .map((asset, i) => (
                <div
                  key={asset.ticker}
                  className="portfolio-bar__segment"
                  style={{
                    width: `${asset.weight}%`,
                    backgroundColor: getAssetColor(asset.ticker, i),
                  }}
                  title={`${asset.ticker}: ${asset.weight} %`}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Tabla detallada de pesos y capital (RF-38, RF-40) */}
      <table className="ui-table opt-table">
        <thead>
          <tr>
            <th scope="col">Activo</th>
            <th scope="col">Empresa</th>
            <th scope="col">Peso actual</th>
            <th scope="col">Peso óptimo</th>
            <th scope="col">Cambio neto</th>
            <th scope="col">Capital óptimo ({originalPortfolio.currency})</th>
          </tr>
        </thead>
        <tbody>
          {result.assets.map((optAsset, i) => {
            const orig = originalPortfolio.assets.find((a) => a.ticker === optAsset.ticker);
            const origWeight = orig?.weight ?? 0;
            const diff = optAsset.weight - origWeight;
            const sample = getSampleAsset(optAsset.ticker);
            const capitalOpt = (originalPortfolio.capital * optAsset.weight) / 100;

            return (
              <tr key={optAsset.ticker}>
                <td>
                  <span
                    className="portfolio-table__dot"
                    style={{ backgroundColor: getAssetColor(optAsset.ticker, i) }}
                  />
                  <strong>{optAsset.ticker}</strong>
                </td>
                <td>{sample?.name ?? optAsset.ticker}</td>
                <td>{origWeight} %</td>
                <td>
                  <strong>{optAsset.weight} %</strong>
                </td>
                <td>
                  <span className={`opt-change-pill ${diff > 0 ? "opt-change-pill--up" : diff < 0 ? "opt-change-pill--down" : ""}`}>
                    {diff > 0 ? `+${diff.toFixed(1)} %` : diff < 0 ? `${diff.toFixed(1)} %` : "Sin cambio"}
                  </span>
                </td>
                <td>{formatMoney(capitalOpt, originalPortfolio.currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Resumen explicativo del resultado */}
      <div className="portfolio-diversification-box">
        <span className="portfolio-diversification-box__title">
          Interpretación del resultado matemático
        </span>
        <p>
          {result.objective === "min_variance"
            ? `La cartera optimizada reduce la volatilidad esperada a un ±${formatPercent(optMetrics.annualVolatility)}, logrando la combinación más estable posible para estos activos.`
            : `La cartera optimizada alcanza un ratio de Sharpe de ${optMetrics.sharpeRatio.toFixed(2)}, ofreciendo la máxima compensación de rendimiento (+${formatPercent(optMetrics.annualReturn)}) por unidad de riesgo asumida.`}
        </p>
      </div>

      {/* Acciones para guardar o simular */}
      <div className="opt-comparison__actions">
        <button
          type="button"
          className="button opt-comparison__sim-btn"
          onClick={onSimulate}
        >
          Simular cartera optimizada en el laboratorio →
        </button>

        <button
          type="button"
          className="button button--secondary"
          onClick={onSaveAsNewVersion}
        >
          Guardar como nueva versión de esta cartera
        </button>

        <button
          type="button"
          className="button button--secondary"
          onClick={onSaveAsNewPortfolio}
        >
          Guardar como nueva cartera
        </button>
      </div>
    </section>
  );
}

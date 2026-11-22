"use client";

import Link from "next/link";
import { getAssetColor } from "@/lib/asset-meta";
import {
  type Portfolio,
  portfolioMetrics,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  getSampleAsset,
} from "@/lib/portfolios";

interface PortfolioCardProps {
  portfolio: Portfolio;
  onSelect: (portfolio: Portfolio) => void;
  onEdit: (portfolio: Portfolio) => void;
  onDuplicate: (portfolio: Portfolio) => void;
  onDelete: (portfolio: Portfolio) => void;
}

export function PortfolioCard({
  portfolio,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
}: PortfolioCardProps) {
  const metrics = portfolioMetrics(portfolio.assets);
  const weightsParam = portfolio.assets.map((a) => a.weight).join(",");
  const simUrl = `/app/simulador?weights=${encodeURIComponent(weightsParam)}&capital=${portfolio.capital}&name=${encodeURIComponent(portfolio.name)}`;

  return (
    <article className="ui-panel portfolio-card" aria-labelledby={`title-${portfolio.id}`}>
      <div className="portfolio-card__top">
        <div className="portfolio-card__title-group">
          <span className="portfolio-badge">v{portfolio.version}</span>
          <h2 id={`title-${portfolio.id}`} className="portfolio-card__name">
            <button
              type="button"
              className="portfolio-card__link-button"
              onClick={() => onSelect(portfolio)}
              title="Ver detalle completo de esta cartera"
            >
              {portfolio.name}
            </button>
          </h2>
        </div>
        <div className="portfolio-card__meta">
          <span className="ui-tag">{portfolio.currency}</span>
        </div>
      </div>

      {portfolio.description ? (
        <p className="portfolio-card__desc">{portfolio.description}</p>
      ) : null}

      <div className="portfolio-card__metrics">
        <div className="portfolio-card__metric">
          <span className="portfolio-card__metric-label">Capital inicial</span>
          <strong className="portfolio-card__metric-val">
            {formatMoney(portfolio.capital, portfolio.currency)}
          </strong>
        </div>

        <div className="portfolio-card__metric">
          <span className="portfolio-card__metric-label">Rendimiento anual</span>
          <strong className="portfolio-card__metric-val portfolio-card__metric-val--pos">
            {metrics ? formatSignedPercent(metrics.annualReturn) : "—"}
          </strong>
        </div>

        <div className="portfolio-card__metric">
          <span className="portfolio-card__metric-label">Volatilidad anual</span>
          <strong className="portfolio-card__metric-val">
            {metrics ? `±${formatPercent(metrics.annualVolatility)}` : "—"}
          </strong>
        </div>

        <div className="portfolio-card__metric">
          <span className="portfolio-card__metric-label">Ratio Sharpe</span>
          <strong className="portfolio-card__metric-val">
            {metrics ? metrics.sharpeRatio.toFixed(2) : "—"}
          </strong>
        </div>
      </div>

      {/* Barra visual de composición porcentual */}
      <div className="portfolio-card__composition" aria-label="Composición porcentual">
        <div className="portfolio-bar" role="img" aria-label="Distribución de activos">
          {portfolio.assets
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

        <div className="portfolio-bar__legend">
          {portfolio.assets
            .filter((a) => a.weight > 0)
            .map((asset, i) => {
              const sample = getSampleAsset(asset.ticker);
              return (
                <span key={asset.ticker} className="portfolio-bar__item">
                  <span
                    className="portfolio-bar__dot"
                    style={{ backgroundColor: getAssetColor(asset.ticker, i) }}
                  />
                  <strong>{asset.ticker}</strong> {asset.weight} %
                </span>
              );
            })}
        </div>
      </div>

      <div className="portfolio-card__actions">
        <button
          type="button"
          className="button button--small"
          onClick={() => onSelect(portfolio)}
        >
          Ver detalle
        </button>

        <Link className="button button--small button--secondary" href={simUrl}>
          Simular riesgo
        </Link>

        <button
          type="button"
          className="link portfolio-card__action-btn"
          onClick={() => onEdit(portfolio)}
        >
          Editar
        </button>

        <button
          type="button"
          className="link portfolio-card__action-btn"
          onClick={() => onDuplicate(portfolio)}
        >
          Duplicar
        </button>

        <button
          type="button"
          className="link portfolio-card__action-btn portfolio-card__action-btn--danger"
          onClick={() => onDelete(portfolio)}
        >
          Eliminar
        </button>
      </div>
    </article>
  );
}

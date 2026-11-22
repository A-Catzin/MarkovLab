"use client";

import { useState } from "react";
import Link from "next/link";
import { getAssetColor } from "@/lib/asset-meta";
import { formatDate } from "@/lib/format";
import {
  type Portfolio,
  type PortfolioVersionSnapshot,
  portfolioMetrics,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  getSampleAsset,
  totalWeight,
} from "@/lib/portfolios";

interface PortfolioDetailProps {
  portfolio: Portfolio;
  onBack: () => void;
  onEdit: (portfolio: Portfolio) => void;
  onNewVersion: (portfolio: Portfolio) => void;
  onDuplicate: (portfolio: Portfolio) => void;
  onDelete: (portfolio: Portfolio) => void;
}

export function PortfolioDetail({
  portfolio,
  onBack,
  onEdit,
  onNewVersion,
  onDuplicate,
  onDelete,
}: PortfolioDetailProps) {
  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(portfolio.version);

  // Determinar si estamos viendo la versión actual o un snapshot histórico
  const isViewingHistorical = selectedVersionNum !== portfolio.version;
  const historicalSnapshot = portfolio.versions?.find((v) => v.version === selectedVersionNum);

  const displayAssets = isViewingHistorical && historicalSnapshot
    ? historicalSnapshot.assets
    : portfolio.assets;

  const displayCapital = isViewingHistorical && historicalSnapshot
    ? historicalSnapshot.capital
    : portfolio.capital;

  const displayCurrency = isViewingHistorical && historicalSnapshot
    ? historicalSnapshot.currency
    : portfolio.currency;

  const metrics = portfolioMetrics(displayAssets);
  const totalW = totalWeight(displayAssets);

  // Parámetros para enviar al simulador
  const weightsParam = displayAssets.map((a) => a.weight).join(",");
  const simUrl = `/app/simulador?weights=${encodeURIComponent(weightsParam)}&capital=${displayCapital}&name=${encodeURIComponent(portfolio.name)}`;

  return (
    <div className="portfolio-detail">
      <nav className="portfolio-detail__nav" aria-label="Navegación de cartera">
        <button type="button" className="link portfolio-detail__back" onClick={onBack}>
          ← Volver a todas las carteras
        </button>
      </nav>

      <header className="portfolio-detail__header">
        <div className="portfolio-detail__title-row">
          <div className="portfolio-detail__title-meta">
            <span className="portfolio-badge">Versión {selectedVersionNum}</span>
            <span className="ui-tag">{displayCurrency}</span>
            {isViewingHistorical ? (
              <span className="ui-tag ui-tag--historical">Histórico</span>
            ) : null}
          </div>
          <h1>{portfolio.name}</h1>
        </div>

        {portfolio.description ? (
          <p className="app-page__lead">{portfolio.description}</p>
        ) : null}

        <div className="portfolio-detail__timestamps">
          <span>Creada: {formatDate(portfolio.createdAt)}</span>
          <span>Última actualización: {formatDate(portfolio.updatedAt)}</span>
        </div>
      </header>

      {/* Indicadores clave (RF-30) */}
      <section className="portfolio-detail__stats" aria-label="Indicadores cuantitativos">
        <div className="ui-panel portfolio-stat-card">
          <span className="portfolio-stat-card__label">Capital asignado</span>
          <strong className="portfolio-stat-card__value">
            {formatMoney(displayCapital, displayCurrency)}
          </strong>
          <small className="portfolio-stat-card__note">Monto base para la ponderación</small>
        </div>

        <div className="ui-panel portfolio-stat-card">
          <span className="portfolio-stat-card__label">Rendimiento anual estimado (μ)</span>
          <strong className="portfolio-stat-card__value portfolio-stat-card__value--accent">
            {metrics ? formatSignedPercent(metrics.annualReturn) : "—"}
          </strong>
          <small className="portfolio-stat-card__note">Media anual esperada ponderada</small>
        </div>

        <div className="ui-panel portfolio-stat-card">
          <span className="portfolio-stat-card__label">Volatilidad anual estimada (σ)</span>
          <strong className="portfolio-stat-card__value">
            {metrics ? `±${formatPercent(metrics.annualVolatility)}` : "—"}
          </strong>
          <small className="portfolio-stat-card__note">Riesgo anual con covarianza</small>
        </div>

        <div className="ui-panel portfolio-stat-card">
          <span className="portfolio-stat-card__label">Ratio de Sharpe</span>
          <strong className="portfolio-stat-card__value">
            {metrics ? metrics.sharpeRatio.toFixed(2) : "—"}
          </strong>
          <small className="portfolio-stat-card__note">Retorno excedente / riesgo (rf = 4.5 %)</small>
        </div>
      </section>

      {/* Composición porcentual y tabla de activos (RF-31) */}
      <section className="ui-panel portfolio-composition" aria-labelledby="comp-title">
        <div className="ui-panel__top">
          <h2 id="comp-title" className="ui-panel__name">
            Composición porcentual ({totalW} %)
          </h2>
          <span className={`ui-tag ${Math.abs(totalW - 100) < 0.01 ? "ui-tag--done" : "ui-sum--bad"}`}>
            {Math.abs(totalW - 100) < 0.01 ? "Ponderación 100 % válida" : `Total: ${totalW} %`}
          </span>
        </div>

        {/* Barra de composición visual */}
        <div className="portfolio-bar portfolio-bar--large" role="img" aria-label="Distribución porcentual">
          {displayAssets
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

        {/* Tabla detallada de activos (RF-28, RF-31) */}
        <table className="ui-table portfolio-table">
          <thead>
            <tr>
              <th scope="col">Activo</th>
              <th scope="col">Empresa</th>
              <th scope="col">Rendimiento anual</th>
              <th scope="col">Volatilidad anual</th>
              <th scope="col">Peso en cartera</th>
              <th scope="col">Monto asignado</th>
            </tr>
          </thead>
          <tbody>
            {displayAssets.map((asset, i) => {
              const sample = getSampleAsset(asset.ticker);
              const amount = displayCapital * (asset.weight / 100);
              return (
                <tr key={asset.ticker}>
                  <td>
                    <span
                      className="portfolio-table__dot"
                      style={{ backgroundColor: getAssetColor(asset.ticker, i) }}
                    />
                    <strong>{asset.ticker}</strong>
                  </td>
                  <td>{sample?.name ?? asset.ticker}</td>
                  <td>{sample ? formatSignedPercent(sample.annualReturn) : "—"}</td>
                  <td>{sample ? `±${formatPercent(sample.annualVolatility)}` : "—"}</td>
                  <td>
                    <strong>{asset.weight} %</strong>
                  </td>
                  <td>{formatMoney(amount, displayCurrency)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="portfolio-table__total">
              <td colSpan={4}>Total cartera</td>
              <td>
                <strong>{totalW} %</strong>
              </td>
              <td>
                <strong>{formatMoney(displayCapital, displayCurrency)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Efecto de diversificación Markowitz */}
        {metrics && metrics.diversificationBenefit > 0.001 ? (
          <div className="portfolio-diversification-box">
            <span className="portfolio-diversification-box__title">
              Efecto de diversificación cuantitativa
            </span>
            <p>
              Gracias a las covarianzas no perfectas entre los activos, la volatilidad de esta cartera
              (±{formatPercent(metrics.annualVolatility)}) es un{" "}
              <strong>{formatPercent(metrics.diversificationBenefit)} menor</strong> que el promedio
              ponderado del riesgo individual de sus componentes.
            </p>
          </div>
        ) : null}
      </section>

      {/* Historial de versiones (RF-32) */}
      {portfolio.versions && portfolio.versions.length > 0 ? (
        <section className="ui-panel portfolio-versions-section" aria-labelledby="versions-title">
          <div className="ui-panel__top">
            <h2 id="versions-title" className="ui-panel__name">
              Historial de versiones de la cartera ({portfolio.versions.length})
            </h2>
            <button
              type="button"
              className="button button--small"
              onClick={() => onNewVersion(portfolio)}
            >
              + Guardar nueva versión
            </button>
          </div>

          <p className="ui-note">
            Guarda diferentes versiones para registrar rebalanceos, cambios de pesos o decisiones
            estratégicas sin perder el registro original.
          </p>

          <ul className="portfolio-versions-list">
            {portfolio.versions
              .slice()
              .reverse()
              .map((ver) => {
                const isSelected = ver.version === selectedVersionNum;
                const isCurrent = ver.version === portfolio.version;
                return (
                  <li
                    key={ver.version}
                    className={`portfolio-version-item ${isSelected ? "portfolio-version-item--active" : ""}`}
                  >
                    <div className="portfolio-version-item__meta">
                      <span className="portfolio-badge">v{ver.version}</span>
                      {isCurrent ? (
                        <span className="ui-tag ui-tag--done">Versión activa</span>
                      ) : null}
                      <span className="portfolio-version-item__date">{ver.createdAt}</span>
                    </div>

                    <div className="portfolio-version-item__content">
                      <p className="portfolio-version-item__note">
                        {ver.note || `Versión ${ver.version}`}
                      </p>
                      <span className="muted">
                        Capital: {formatMoney(ver.capital, ver.currency)} ·{" "}
                        {ver.assets.map((a) => `${a.ticker}: ${a.weight}%`).join(", ")}
                      </span>
                    </div>

                    <div className="portfolio-version-item__action">
                      {isSelected ? (
                        <span className="portfolio-version-item__status">Viendo ahora</span>
                      ) : (
                        <button
                          type="button"
                          className="link"
                          onClick={() => setSelectedVersionNum(ver.version)}
                        >
                          Ver esta versión
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ) : null}

      {/* Acciones principales de la cartera */}
      <footer className="portfolio-detail__actions">
        <Link className="button portfolio-detail__cta" href={simUrl}>
          Simular esta cartera en el laboratorio →
        </Link>

        <button
          type="button"
          className="button button--secondary"
          onClick={() => onEdit(portfolio)}
        >
          Editar activos y pesos
        </button>

        <button
          type="button"
          className="button button--secondary"
          onClick={() => onNewVersion(portfolio)}
        >
          Nueva versión
        </button>

        <button
          type="button"
          className="button button--secondary"
          onClick={() => onDuplicate(portfolio)}
        >
          Duplicar
        </button>

        <button
          type="button"
          className="link portfolio-detail__delete"
          onClick={() => onDelete(portfolio)}
        >
          Eliminar cartera
        </button>
      </footer>
    </div>
  );
}

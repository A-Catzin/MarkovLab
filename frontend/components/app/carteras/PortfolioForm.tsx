"use client";

import { useState } from "react";
import {
  type Portfolio,
  type PortfolioAsset,
  type Currency,
  CURRENCIES,
  MAX_CAPITAL,
  portfolioMetrics,
  formatMoney,
  formatPercent,
  formatSignedPercent,
  getSampleAsset,
  totalWeight,
  WEIGHT_TOLERANCE,
} from "@/lib/portfolios";
import { SAMPLE_ASSETS } from "@/lib/landing-data";

interface PortfolioFormProps {
  initialPortfolio?: Portfolio | null;
  mode: "create" | "edit" | "new_version";
  onSave: (portfolioData: {
    name: string;
    capital: number;
    currency: Currency;
    assets: PortfolioAsset[];
    note?: string;
  }) => void;
  onCancel: () => void;
}

export function PortfolioForm({
  initialPortfolio,
  mode,
  onSave,
  onCancel,
}: PortfolioFormProps) {
  const isNewVersion = mode === "new_version";
  const isCreate = mode === "create";

  const [name, setName] = useState(
    initialPortfolio ? initialPortfolio.name : "Mi cartera de inversión",
  );
  const [capital, setCapital] = useState<number>(
    initialPortfolio ? initialPortfolio.capital : 10_000,
  );
  const [currency, setCurrency] = useState<Currency>(
    initialPortfolio ? initialPortfolio.currency : "MXN",
  );
  const [note, setNote] = useState(
    isNewVersion ? `Rebalanceo y ajuste para versión ${((initialPortfolio?.version ?? 1) + 1)}` : "",
  );

  // Activos actuales en el formulario
  const [assets, setAssets] = useState<PortfolioAsset[]>(
    initialPortfolio && initialPortfolio.assets.length > 0
      ? initialPortfolio.assets.map((a) => ({ ...a }))
      : [
          { ticker: "AAPL", weight: 35 },
          { ticker: "MSFT", weight: 35 },
          { ticker: "JPM", weight: 15 },
          { ticker: "XOM", weight: 15 },
        ],
  );

  // Activo seleccionado en el dropdown para agregar
  const availableToAdd = SAMPLE_ASSETS.filter(
    (sample) => !assets.some((a) => a.ticker === sample.ticker),
  );
  const [selectedToAdd, setSelectedToAdd] = useState<string>(
    availableToAdd.length > 0 ? availableToAdd[0].ticker : "",
  );

  const total = totalWeight(assets);
  const totalValid = Math.abs(total - 100) <= WEIGHT_TOLERANCE;
  const capitalValid = Number.isFinite(capital) && capital > 0 && capital <= MAX_CAPITAL;
  const nameValid = name.trim().length > 0;
  const isValid = totalValid && capitalValid && nameValid && assets.length > 0;

  const metrics = portfolioMetrics(assets);

  function handleWeightChange(index: number, newWeight: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(newWeight)));
    setAssets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], weight: clamped };
      return next;
    });
  }

  function handleRemoveAsset(ticker: string) {
    if (assets.length <= 1) return;
    setAssets((prev) => prev.filter((a) => a.ticker !== ticker));
  }

  function handleAddAsset() {
    if (!selectedToAdd) return;
    const sample = SAMPLE_ASSETS.find((a) => a.ticker === selectedToAdd);
    if (!sample) return;

    setAssets((prev) => [...prev, { ticker: sample.ticker, weight: 0 }]);
    // Actualizar selección siguiente
    const remaining = availableToAdd.filter((s) => s.ticker !== selectedToAdd);
    if (remaining.length > 0) setSelectedToAdd(remaining[0].ticker);
    else setSelectedToAdd("");
  }

  function handleEquirepartir() {
    if (assets.length === 0) return;
    const count = assets.length;
    const base = Math.floor(100 / count);
    const remainder = 100 - base * count;

    setAssets((prev) =>
      prev.map((asset, i) => ({
        ...asset,
        weight: base + (i < remainder ? 1 : 0),
      })),
    );
  }

  function handleNormalizeWeights() {
    if (assets.length === 0 || total <= 0) return;
    let distributed = 0;
    const next = assets.map((a, i) => {
      if (i === assets.length - 1) {
        return { ...a, weight: Math.max(0, 100 - distributed) };
      }
      const proportional = Math.round((a.weight / total) * 100);
      distributed += proportional;
      return { ...a, weight: proportional };
    });
    setAssets(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    onSave({
      name: name.trim(),
      capital,
      currency,
      assets,
      note: note.trim() || undefined,
    });
  }

  let weightHint: string;
  if (totalValid) {
    weightHint = "Ponderación exacta: 100 %";
  } else if (total < 100) {
    weightHint = `Te falta asignar ${(100 - total).toFixed(1)} %`;
  } else {
    weightHint = `Te pasaste por ${(total - 100).toFixed(1)} %: reduce algún activo`;
  }

  return (
    <form className="ui-panel portfolio-form" onSubmit={handleSubmit} data-ui>
      <div className="ui-panel__top">
        <h2 className="ui-panel__name">
          {isCreate
            ? "Nueva cartera de inversión"
            : isNewVersion
              ? `Guardar como nueva versión (v${(initialPortfolio?.version ?? 1) + 1})`
              : `Editar cartera: ${initialPortfolio?.name}`}
        </h2>
        <span className="ui-tag">
          {isCreate ? "Creación" : isNewVersion ? "Nueva versión" : "Edición"}
        </span>
      </div>

      <p className="ui-note">
        {isNewVersion
          ? "Se conservará la versión anterior en el historial de esta cartera para que puedas consultarla o compararla."
          : "Define el nombre, capital y la distribución porcentual entre los activos. La suma de pesos debe ser exactamente 100 %."}
      </p>

      {/* Datos generales de la cartera */}
      <div className="ui-fields portfolio-form__fields">
        <label>
          Nombre de la cartera
          <input
            type="text"
            required
            placeholder="Ej. Cartera Equilibrada Tech & Renta"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label>
          Capital inicial ({currency})
          <input
            type="number"
            min={1}
            max={MAX_CAPITAL}
            step="any"
            required
            value={Number.isNaN(capital) ? "" : capital}
            onChange={(e) => setCapital(Number.parseFloat(e.target.value))}
          />
        </label>

        <label>
          Moneda
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {isNewVersion ? (
          <label>
            Nota de este rebalanceo
            <input
              type="text"
              placeholder="Ej. Ajuste de pesos por volatilidad"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        ) : null}
      </div>

      {/* Lista de activos y controles de peso */}
      <div className="portfolio-form__assets-section">
        <div className="portfolio-form__assets-header">
          <span className="portfolio-form__section-title">Activos y pesos asignados</span>
          <div className="portfolio-form__helpers">
            <button
              type="button"
              className="button button--small button--secondary"
              onClick={handleEquirepartir}
              title="Repartir 100 % de manera equitativa entre todos los activos"
            >
              Equirepartir
            </button>
            <button
              type="button"
              className="button button--small button--secondary"
              onClick={handleNormalizeWeights}
              title="Escalar proporcionalmente para que sumen exactamente 100 %"
            >
              Ajustar al 100 %
            </button>
          </div>
        </div>

        <div className="portfolio-form__asset-rows">
          {assets.map((asset, index) => {
            const sample = getSampleAsset(asset.ticker);
            const allocatedAmount = (capital || 0) * (asset.weight / 100);

            return (
              <div key={asset.ticker} className="portfolio-asset-row">
                <div className="portfolio-asset-row__info">
                  <strong>{asset.ticker}</strong>
                  <span className="muted">{sample?.name ?? asset.ticker}</span>
                  {sample ? (
                    <small className="portfolio-asset-row__stats">
                      μ {formatSignedPercent(sample.annualReturn)} · σ ±{formatPercent(sample.annualVolatility)}
                    </small>
                  ) : null}
                </div>

                <div className="portfolio-asset-row__controls">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={asset.weight}
                    onChange={(e) => handleWeightChange(index, Number(e.target.value))}
                    aria-label={`Peso de ${asset.ticker}`}
                  />

                  <div className="portfolio-asset-row__inputs">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={asset.weight}
                      onChange={(e) => handleWeightChange(index, Number(e.target.value))}
                      className="portfolio-asset-row__num"
                    />
                    <span>%</span>
                  </div>

                  <span className="portfolio-asset-row__money">
                    {formatMoney(allocatedAmount, currency)}
                  </span>

                  <button
                    type="button"
                    className="portfolio-asset-row__remove"
                    onClick={() => handleRemoveAsset(asset.ticker)}
                    disabled={assets.length <= 1}
                    title={assets.length <= 1 ? "La cartera debe tener al menos un activo" : "Quitar activo"}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Agregar nuevo activo del catálogo */}
        {availableToAdd.length > 0 ? (
          <div className="portfolio-form__add-bar">
            <label className="portfolio-form__add-label">
              <span>Agregar otro activo del catálogo:</span>
              <select
                value={selectedToAdd}
                onChange={(e) => setSelectedToAdd(e.target.value)}
              >
                {availableToAdd.map((s) => (
                  <option key={s.ticker} value={s.ticker}>
                    {s.ticker} — {s.name} (μ {formatSignedPercent(s.annualReturn)}, σ ±{formatPercent(s.annualVolatility)})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button button--small button--secondary"
              onClick={handleAddAsset}
            >
              + Agregar activo
            </button>
          </div>
        ) : null}
      </div>

      {/* Previsualización cuantitativa en tiempo real */}
      <div className="portfolio-form__preview">
        <div className="portfolio-form__preview-row">
          <span className="portfolio-form__preview-title">Métricas estimadas en tiempo real:</span>
          <div className="portfolio-form__preview-badges">
            <span>Rendimiento: <strong>{metrics ? formatSignedPercent(metrics.annualReturn) : "—"}</strong></span>
            <span>Volatilidad: <strong>{metrics ? `±${formatPercent(metrics.annualVolatility)}` : "—"}</strong></span>
            <span>Ratio Sharpe: <strong>{metrics ? metrics.sharpeRatio.toFixed(2) : "—"}</strong></span>
          </div>
        </div>
      </div>

      {/* Barra de estado y acciones */}
      <div className="ui-actions portfolio-form__actions">
        <div className="portfolio-form__status">
          <span className={`ui-tag ${totalValid ? "ui-tag--done" : "ui-sum--bad"}`}>
            Total asignado: {total.toFixed(1)} %
          </span>
          <span className="muted">{weightHint}</span>
        </div>

        <div className="portfolio-form__buttons">
          <button
            type="button"
            className="link portfolio-form__cancel"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button"
            disabled={!isValid}
          >
            {isCreate
              ? "Crear cartera"
              : isNewVersion
                ? "Guardar nueva versión"
                : "Guardar cambios"}
          </button>
        </div>
      </div>
    </form>
  );
}

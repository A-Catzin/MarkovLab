"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate, formatMoney, formatPercent, formatWeight } from "@/lib/format";
import { SAMPLE_ASSETS } from "@/lib/landing-data";
import {
  CURRENCIES,
  DEMO_PORTFOLIOS,
  MAX_CAPITAL,
  createId,
  portfolioMetrics,
  readPortfolios,
  todayISO,
  totalWeight,
  validatePortfolio,
  writePortfolios,
  type Currency,
  type Portfolio,
  type PortfolioAsset,
} from "@/lib/portfolios";

type Draft = {
  id?: string;
  name: string;
  capital: number;
  currency: Currency;
  createdAt: string;
  version: number;
  assets: PortfolioAsset[];
};

const BAR_OPACITY = [0.95, 0.75, 0.55, 0.35];

/** Reparto inicial en partes iguales entre los cuatro activos de ejemplo. */
function equalAssets(): PortfolioAsset[] {
  const weight = Math.round(100 / SAMPLE_ASSETS.length);
  return SAMPLE_ASSETS.map((asset, index) => ({
    ticker: asset.ticker,
    weight: index === SAMPLE_ASSETS.length - 1 ? 100 - weight * (SAMPLE_ASSETS.length - 1) : weight,
  }));
}

function CompositionBar({ assets }: { assets: PortfolioAsset[] }) {
  const total = totalWeight(assets) || 100;
  const visible = assets.filter((asset) => asset.weight > 0);
  const label = visible.map((asset) => `${asset.ticker} ${formatWeight(asset.weight)}`).join(", ");

  return (
    <div className="pf-bar" role="img" aria-label={visible.length > 0 ? `Composición: ${label}` : "Cartera sin activos"}>
      {visible.map((asset, index) => (
        <span
          key={asset.ticker}
          style={{
            width: `${(asset.weight / total) * 100}%`,
            backgroundColor: "var(--accent)",
            opacity: BAR_OPACITY[index % BAR_OPACITY.length],
          }}
        />
      ))}
    </div>
  );
}

function Metrics({ assets }: { assets: PortfolioAsset[] }) {
  const metrics = portfolioMetrics(assets);
  if (!metrics) return <p className="muted">Sin activos con peso.</p>;

  return (
    <dl className="pf-metrics">
      <div>
        <dt>Gana al año</dt>
        <dd>{formatPercent(metrics.annualReturn)}</dd>
      </div>
      <div>
        <dt>Cuánto varía</dt>
        <dd>±{formatPercent(metrics.annualVolatility)}</dd>
      </div>
    </dl>
  );
}

export function PortfolioManager() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>(DEMO_PORTFOLIOS);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");

  // La primera pintura usa las carteras de ejemplo (igual en servidor y cliente);
  // después se reemplazan por lo guardado en el navegador para evitar desajustes.
  useEffect(() => {
    const saved = readPortfolios();
    if (saved === null) writePortfolios(DEMO_PORTFOLIOS);
    else setPortfolios(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writePortfolios(portfolios);
  }, [portfolios, ready]);

  const errors = useMemo(() => (draft ? validatePortfolio(draft) : []), [draft]);
  const total = draft ? totalWeight(draft.assets) : 0;
  const metrics = draft ? portfolioMetrics(draft.assets) : null;
  const capitalValid = draft ? Number.isFinite(draft.capital) && draft.capital > 0 : false;

  function startCreate() {
    setDraft({
      name: "",
      capital: 10_000,
      currency: "MXN",
      createdAt: todayISO(),
      version: 1,
      assets: equalAssets(),
    });
    setNotice("");
  }

  function startEdit(portfolio: Portfolio) {
    setDraft({
      id: portfolio.id,
      name: portfolio.name,
      capital: portfolio.capital,
      currency: portfolio.currency,
      createdAt: portfolio.createdAt,
      version: portfolio.version,
      assets: portfolio.assets.map((asset) => ({ ...asset })),
    });
    setNotice("");
  }

  function updateWeight(index: number, value: number) {
    setDraft((current) =>
      current
        ? {
            ...current,
            assets: current.assets.map((asset, i) => (i === index ? { ...asset, weight: value } : asset)),
          }
        : current,
    );
  }

  function save(asVersion: boolean) {
    if (!draft) return;
    if (errors.length > 0) {
      setNotice(errors[0]);
      return;
    }

    const now = new Date().toISOString();
    const base = {
      name: draft.name.trim(),
      capital: draft.capital,
      currency: draft.currency,
      assets: draft.assets.map((asset) => ({ ...asset })),
    };

    if (!draft.id) {
      const created: Portfolio = { ...base, id: createId(), createdAt: todayISO(), updatedAt: now, version: 1 };
      setPortfolios((list) => [created, ...list]);
      setNotice(`“${created.name}” se guardó en este navegador.`);
    } else if (asVersion) {
      const version = draft.version + 1;
      const created: Portfolio = { ...base, id: createId(), createdAt: todayISO(), updatedAt: now, version };
      setPortfolios((list) => [created, ...list]);
      setNotice(`“${created.name}” se guardó como versión ${version}.`);
    } else {
      setPortfolios((list) =>
        list.map((portfolio) => (portfolio.id === draft.id ? { ...portfolio, ...base, updatedAt: now } : portfolio)),
      );
      setNotice(`“${base.name}” se actualizó.`);
    }

    setDraft(null);
  }

  function duplicate(portfolio: Portfolio) {
    const copy: Portfolio = {
      ...portfolio,
      id: createId(),
      name: `${portfolio.name} (copia)`,
      createdAt: todayISO(),
      updatedAt: new Date().toISOString(),
      version: 1,
      assets: portfolio.assets.map((asset) => ({ ...asset })),
    };
    setPortfolios((list) => [copy, ...list]);
    setNotice(`“${portfolio.name}” se duplicó como “${copy.name}”.`);
  }

  function remove(portfolio: Portfolio) {
    const confirmed = window.confirm(
      `¿Eliminar “${portfolio.name}”? Esta acción no se puede deshacer y las versiones guardadas se conservan.`,
    );
    if (!confirmed) return;
    setPortfolios((list) => list.filter((item) => item.id !== portfolio.id));
    setNotice(`“${portfolio.name}” se eliminó.`);
  }

  if (draft) {
    return (
      <div className="pf-editor">
        <header className="pf-editor__head">
          <h2>{draft.id ? "Editar cartera" : "Nueva cartera"}</h2>
          <p className="muted">
            Define el capital y reparte los pesos entre los cuatro activos de ejemplo. La estimación se calcula con el
            mismo modelo de la cartera del simulador.
          </p>
        </header>

        <form
          className="pf-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            save(false);
          }}
        >
          <div className="ui-panel" data-ui>
            <div className="ui-panel__top">
              <span className="ui-panel__name">Datos de la cartera</span>
              <span className={`ui-tag ${capitalValid ? "" : "ui-sum--bad"}`} aria-live="polite">
                {capitalValid ? draft.currency : "Revisa el capital"}
              </span>
            </div>
            <div className="ui-fields pf-fields">
              <label>
                Nombre
                <input
                  type="text"
                  value={draft.name}
                  maxLength={60}
                  placeholder="Mi cartera"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </label>
              <label>
                Capital inicial ({draft.currency})
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={MAX_CAPITAL}
                  step="any"
                  value={Number.isNaN(draft.capital) ? "" : draft.capital}
                  onChange={(event) => setDraft({ ...draft, capital: Number.parseFloat(event.target.value) })}
                />
              </label>
              <label>
                Moneda
                <select
                  value={draft.currency}
                  onChange={(event) => setDraft({ ...draft, currency: event.target.value as Currency })}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fecha de creación
                <input type="text" value={formatDate(draft.createdAt)} readOnly />
              </label>
            </div>
          </div>

          <div className="ui-panel" data-ui>
            <div className="ui-panel__top">
              <span className="ui-panel__name">Activos y pesos</span>
              <span className={`ui-tag ${Math.abs(total - 100) <= 0.01 ? "" : "ui-sum--bad"}`} aria-live="polite">
                Repartido: {formatWeight(total)}
              </span>
            </div>

            <div className="pf-weights">
              {draft.assets.map((asset, index) => {
                const info = SAMPLE_ASSETS.find((sample) => sample.ticker === asset.ticker);
                const value = Number.isFinite(asset.weight) ? asset.weight : 0;
                return (
                  <div className="pf-weight" key={asset.ticker}>
                    <div className="pf-weight__name">
                      <strong>{asset.ticker}</strong>
                      <span className="muted">{info?.name}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={value}
                      aria-label={`Peso de ${info?.name ?? asset.ticker}`}
                      onChange={(event) => updateWeight(index, Number(event.target.value))}
                    />
                    <input
                      className="pf-weight__input"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      step={1}
                      value={Number.isFinite(asset.weight) ? asset.weight : ""}
                      aria-label={`Peso de ${info?.name ?? asset.ticker} en porcentaje`}
                      onChange={(event) => updateWeight(index, Number.parseFloat(event.target.value))}
                    />
                    <span className="pf-weight__unit">%</span>
                  </div>
                );
              })}
            </div>

            <p className="ui-note">
              Los pesos deben sumar 100 %. “Gana al año” y “cuánto varía” son estimaciones con cifras de ejemplo, no
              datos de mercado.
            </p>
          </div>

          {metrics ? (
            <div className="ui-panel pf-preview" data-ui aria-live="polite">
              <div className="ui-panel__top">
                <span className="ui-panel__name">Estimación de la cartera</span>
                <span className="ui-tag">Datos de ejemplo</span>
              </div>
              <div className="pf-preview__body">
                <Metrics assets={draft.assets} />
                <p className="muted">
                  Capital: {capitalValid ? formatMoney(draft.capital, draft.currency) : "—"}
                </p>
              </div>
            </div>
          ) : null}

          {errors.length > 0 ? (
            <ul className="pf-errors" aria-live="polite">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}

          <div className="pf-form__actions">
            <button className="button" type="submit" disabled={errors.length > 0}>
              {draft.id ? "Guardar cambios" : "Guardar cartera"}
            </button>
            {draft.id ? (
              <button className="button button--ghost" type="button" disabled={errors.length > 0} onClick={() => save(true)}>
                Guardar como versión
              </button>
            ) : null}
            <button className="pf-action" type="button" onClick={() => setDraft(null)}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="pf">
      <div className="pf-toolbar">
        <p className="muted" aria-live="polite">
          {portfolios.length === 0
            ? "No hay carteras guardadas."
            : `${portfolios.length} ${portfolios.length === 1 ? "cartera guardada" : "carteras guardadas"} en este navegador.`}
        </p>
        <button className="button button--small" type="button" onClick={startCreate}>
          Nueva cartera
        </button>
      </div>

      {notice ? (
        <p className="pf-notice" role="status">
          {notice}
        </p>
      ) : null}

      {portfolios.length === 0 ? (
        <div className="ui-panel pf-empty">
          <p className="ui-panel__name">Tu primera cartera</p>
          <p className="muted">
            Crea una cartera con los cuatro activos de ejemplo, ajusta los pesos y guarda distintas versiones para
            comparar decisiones.
          </p>
          <button className="button" type="button" onClick={startCreate}>
            Crear cartera
          </button>
        </div>
      ) : (
        <ul className="pf-list" aria-label="Carteras guardadas">
          {portfolios.map((portfolio) => (
            <li key={portfolio.id}>
              <article className="pf-card">
                <header className="pf-card__top">
                  <div>
                    <h2>{portfolio.name}</h2>
                    <p className="pf-card__meta">
                      {formatMoney(portfolio.capital, portfolio.currency)} · creada el {formatDate(portfolio.createdAt)}
                    </p>
                  </div>
                  <span className="ui-tag">{portfolio.version > 1 ? `Versión ${portfolio.version}` : "Original"}</span>
                </header>

                <CompositionBar assets={portfolio.assets} />

                <ul className="pf-card__assets" aria-label={`Composición de ${portfolio.name}`}>
                  {portfolio.assets.map((asset) => (
                    <li
                      key={asset.ticker}
                      className={asset.weight > 0 ? undefined : "pf-card__asset--zero"}
                    >
                      <span>{asset.ticker}</span>
                      <span>{formatWeight(asset.weight)}</span>
                    </li>
                  ))}
                </ul>

                <div className="pf-card__bottom">
                  <Metrics assets={portfolio.assets} />
                  <div className="pf-card__actions">
                    <button className="pf-action" type="button" onClick={() => startEdit(portfolio)}>
                      Editar
                    </button>
                    <button className="pf-action" type="button" onClick={() => duplicate(portfolio)}>
                      Duplicar
                    </button>
                    <button className="pf-action" type="button" onClick={() => remove(portfolio)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      <p className="pf-footnote">
        Las carteras se guardan solo en este navegador. Cuando la API de MarkovLab esté lista, pasarán a la base de
        datos de tu cuenta.
      </p>
    </div>
  );
}

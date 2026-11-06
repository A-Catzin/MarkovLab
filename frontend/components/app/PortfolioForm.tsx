"use client";

import { useActionState, useMemo, useState } from "react";
import { createPortfolio, type PortfolioFormState } from "@/app/app/carteras/actions";

export interface AssetOption {
  id: number;
  label: string;
  currency: string;
}

interface Row {
  key: number;
  assetId: string;
  percent: string;
}

const CURRENCIES = ["MXN", "USD", "EUR"];
const MAX_ROWS = 50;

/**
 * Formulario de nueva cartera: nombre, capital, moneda y una fila por activo con su
 * porcentaje. Muestra en vivo cuánto suma (debe dar 100 %) y ofrece repartir en partes
 * iguales. El guardado y la validación definitiva los hace el servidor.
 */
export function PortfolioForm({ assets }: { assets: AssetOption[] }) {
  const [state, formAction, pending] = useActionState<PortfolioFormState, FormData>(createPortfolio, { error: null });
  const [rows, setRows] = useState<Row[]>([{ key: 0, assetId: "", percent: "" }]);
  const [nextKey, setNextKey] = useState(1);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.percent.replace(",", ".")) || 0), 0),
    [rows],
  );
  const totalOk = Math.abs(total - 100) < 0.005;
  const used = new Set(rows.map((row) => row.assetId).filter(Boolean));

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const addRow = () => {
    setRows((current) => [...current, { key: nextKey, assetId: "", percent: "" }]);
    setNextKey((k) => k + 1);
  };
  const removeRow = (key: number) => setRows((current) => current.filter((row) => row.key !== key));
  // Reparte 100 % en partes iguales con dos decimales; la última fila absorbe el redondeo.
  const splitEvenly = () =>
    setRows((current) => {
      const share = Math.floor(10000 / current.length) / 100;
      return current.map((row, i) => ({
        ...row,
        percent: i === current.length - 1 ? (100 - share * (current.length - 1)).toFixed(2) : share.toFixed(2),
      }));
    });

  return (
    <form action={formAction} className="pf-form">
      <div className="pf-form__fields">
        <label className="field">
          <span>Nombre</span>
          <input name="name" required maxLength={120} placeholder="Por ejemplo: Tecnología a largo plazo" />
        </label>
        <label className="field">
          <span>Capital inicial</span>
          <input name="capital" required inputMode="decimal" placeholder="10000" />
        </label>
        <label className="field">
          <span>Moneda</span>
          <select name="currency" defaultValue="MXN">
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="pf-form__positions">
        <legend>Activos y porcentajes</legend>
        {rows.map((row, index) => (
          <div className="pf-row" key={row.key}>
            <label className="field">
              <span className={index > 0 ? "sr-only" : undefined}>Activo</span>
              <select
                name="asset_id"
                required
                value={row.assetId}
                onChange={(event) => update(row.key, { assetId: event.target.value })}
              >
                <option value="">Elige un activo</option>
                {assets.map((asset) => (
                  <option
                    key={asset.id}
                    value={String(asset.id)}
                    disabled={used.has(String(asset.id)) && row.assetId !== String(asset.id)}
                  >
                    {asset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field pf-row__percent">
              <span className={index > 0 ? "sr-only" : undefined}>Porcentaje</span>
              <input
                name="weight"
                required
                inputMode="decimal"
                placeholder="0"
                value={row.percent}
                onChange={(event) => update(row.key, { percent: event.target.value })}
              />
            </label>
            <button
              type="button"
              className="pf-row__remove"
              onClick={() => removeRow(row.key)}
              disabled={rows.length === 1}
              aria-label={`Quitar fila ${index + 1}`}
            >
              Quitar
            </button>
          </div>
        ))}
        <div className="pf-form__tools">
          <button type="button" className="link pf-form__tool" onClick={addRow} disabled={rows.length >= Math.min(MAX_ROWS, assets.length)}>
            Agregar activo
          </button>
          <button type="button" className="link pf-form__tool" onClick={splitEvenly}>
            Repartir en partes iguales
          </button>
          <p className={`pf-form__total ${totalOk ? "pf-form__total--ok" : ""}`} aria-live="polite">
            Suma: {total.toLocaleString("es-MX", { maximumFractionDigits: 2 })} %{totalOk ? "" : " (debe dar 100 %)"}
          </p>
        </div>
      </fieldset>

      {state.error && (
        <p className="notice notice--error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="button pf-form__submit" disabled={pending || !totalOk} aria-busy={pending}>
        {pending ? "Guardando…" : "Guardar cartera"}
      </button>
    </form>
  );
}

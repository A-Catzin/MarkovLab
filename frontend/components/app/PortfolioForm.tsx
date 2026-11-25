"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";
import { createPortfolio, updatePortfolioAction, type PortfolioFormState } from "@/app/app/carteras/actions";
import { type ValidationIssue } from "@/lib/modules/runtime";
import { validatePortfolioEditInput } from "@/lib/modules/validators";
import { ErrorSummary } from "./ModuleStateViews";
import styles from "./modules.module.css";

export interface AssetOption {
  id: number;
  label: string;
  currency: string;
}

export interface PortfolioFormInitialValues {
  name: string;
  capital: number;
  currency: string;
  startDate: string;
  positions: { assetId: number; percent: number }[];
}

interface Row {
  key: number;
  assetId: string;
  percent: string;
}

const CURRENCIES = ["MXN", "USD", "EUR"];
const MAX_ROWS = 50;

/**
 * Formulario de cartera reutilizable para creación (`mode="create"`) y edición (`mode="edit"`).
 * Conserva sin cambios la acción de servidor `createPortfolio` al crear carteras nuevas y
 * añade soporte de fecha de referencia, resumen de validación enfocable y aviso explícito
 * cuando el guardado en backend (`B3`) aún no está conectado.
 */
export function PortfolioForm({
  assets,
  mode = "create",
  portfolioId,
  initialValues,
  pendingBackend = false,
  submitLabel,
  cancelHref,
  initialShowValidationDemo = false,
}: {
  assets: AssetOption[];
  mode?: "create" | "edit";
  portfolioId?: string;
  initialValues?: PortfolioFormInitialValues;
  pendingBackend?: boolean;
  submitLabel?: string;
  cancelHref?: string;
  initialShowValidationDemo?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<PortfolioFormState, FormData>(createPortfolio, { error: null });
  const initialRows: Row[] =
    initialValues && initialValues.positions.length > 0
      ? initialValues.positions.map((pos, index) => ({
          key: index,
          assetId: String(pos.assetId),
          percent: String(pos.percent),
        }))
      : [{ key: 0, assetId: "", percent: "" }];

  const [name, setName] = useState(initialValues?.name ?? "");
  const [capital, setCapital] = useState(initialValues ? String(initialValues.capital) : "");
  const [currency, setCurrency] = useState(initialValues?.currency ?? "MXN");
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? "2026-01-05");
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [nextKey, setNextKey] = useState(initialRows.length);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editIssues, setEditIssues] = useState<ValidationIssue[]>(() =>
    initialShowValidationDemo
      ? validatePortfolioEditInput({
          name: "",
          capital: 0,
          currency: initialValues?.currency ?? "MXN",
          startDate: initialValues?.startDate ?? "2026-01-05",
          positions: [{ assetId: 1, percent: 45 }, { assetId: 2, percent: 45 }],
        })
      : [],
  );
  const [focusKey, setFocusKey] = useState(0);
  const [editNotice, setEditNotice] = useState<string | null>(null);

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

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedPositions = rows.map((row) => ({
      assetId: Number(row.assetId),
      percent: Number(row.percent.replace(",", ".")),
    }));
    const numericCapital = Number(capital.replace(/,/g, ""));
    const issues = validatePortfolioEditInput({
      name,
      capital: numericCapital,
      currency,
      startDate,
      positions: parsedPositions,
    });
    if (issues.length > 0) {
      setEditNotice(null);
      setEditIssues(issues);
      setFocusKey((k) => k + 1);
      return;
    }
    setEditIssues([]);
    if (pendingBackend || !portfolioId) {
      setEditNotice(
        "Validación correcta (suma 100 %, sin activos duplicados). El guardado definitivo de nuevas versiones espera el endpoint B3 del backend; no se simuló persistencia.",
      );
      return;
    }

    setSavingEdit(true);
    setEditNotice(null);
    const saved = await updatePortfolioAction(portfolioId, {
      name,
      capital: numericCapital,
      currency,
      startDate,
      positions: parsedPositions,
    });
    setSavingEdit(false);
    if (!saved.ok) {
      setEditIssues([{ field: "portfolio-name", message: saved.error ?? "No pudimos actualizar la cartera." }]);
      setFocusKey((k) => k + 1);
      return;
    }
    setEditNotice("Nueva versión guardada en el historial de la cartera.");
    router.refresh();
  }

  const isBusy = mode === "create" ? pending : savingEdit;

  return (
    <form action={mode === "create" ? formAction : undefined} onSubmit={mode === "edit" ? handleEditSubmit : undefined} className="pf-form" noValidate={mode === "edit"}>
      <div className="pf-form__fields">
        <label className="field" htmlFor="portfolio-name">
          <span>Nombre</span>
          <input
            id="portfolio-name"
            name="name"
            required
            maxLength={120}
            placeholder="Por ejemplo: Tecnología a largo plazo"
            value={mode === "edit" ? name : undefined}
            onChange={mode === "edit" ? (e) => setName(e.target.value) : undefined}
          />
        </label>
        <label className="field" htmlFor="portfolio-capital">
          <span>Capital inicial</span>
          <input
            id="portfolio-capital"
            name="capital"
            required
            inputMode="decimal"
            placeholder="10000"
            value={mode === "edit" ? capital : undefined}
            onChange={mode === "edit" ? (e) => setCapital(e.target.value) : undefined}
          />
        </label>
        <label className="field" htmlFor="portfolio-currency">
          <span>Moneda</span>
          <select
            id="portfolio-currency"
            name="currency"
            defaultValue={mode === "create" ? "MXN" : undefined}
            value={mode === "edit" ? currency : undefined}
            onChange={mode === "edit" ? (e) => setCurrency(e.target.value) : undefined}
          >
            {CURRENCIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="portfolio-start-date">
          <span>{mode === "edit" ? "Fecha de referencia" : "Fecha de referencia (opcional)"}</span>
          <input
            id="portfolio-start-date"
            name="start_date"
            type="date"
            defaultValue={mode === "create" ? "" : undefined}
            value={mode === "edit" ? startDate : undefined}
            onChange={mode === "edit" ? (e) => setStartDate(e.target.value) : undefined}
          />
        </label>
      </div>

      <fieldset id="portfolio-positions" className="pf-form__positions">
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
          <button
            type="button"
            className="link pf-form__tool"
            onClick={addRow}
            disabled={rows.length >= Math.min(MAX_ROWS, assets.length)}
          >
            Agregar activo
          </button>
          <button type="button" className="link pf-form__tool" onClick={splitEvenly}>
            Repartir en partes iguales
          </button>
          <p id="portfolio-total" className={`pf-form__total ${totalOk ? "pf-form__total--ok" : ""}`} aria-live="polite">
            Suma: {total.toLocaleString("es-MX", { maximumFractionDigits: 2 })} %{totalOk ? "" : " (debe dar 100 %)"}
          </p>
        </div>
      </fieldset>

      {mode === "create" && state.error && (
        <p className="notice notice--error" role="alert">
          {state.error}
        </p>
      )}
      {mode === "edit" && <ErrorSummary issues={editIssues} focusKey={focusKey} />}
      {mode === "edit" && editNotice && (
        <p className="notice" role="status">
          {editNotice}
        </p>
      )}

      <div className={styles.actionRow} style={{ marginTop: 16 }}>
        <button
          type="submit"
          className="button pf-form__submit"
          style={{ marginTop: 0 }}
          disabled={mode === "create" ? pending || !totalOk : isBusy}
          aria-busy={isBusy}
        >
          {isBusy ? "Guardando…" : submitLabel ?? (mode === "edit" ? "Guardar nueva versión" : "Guardar cartera")}
        </button>
        {cancelHref && (
          <Link href={cancelHref} className="button button--small button--quiet">
            Volver
          </Link>
        )}
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { importCsv, type ImportFormState } from "@/app/admin/importaciones/actions";

const STATUS_TEXT = {
  success: "Importación completa",
  partial: "Importación parcial: algunas filas no eran válidas",
  failed: "Importación fallida: ninguna fila era válida",
} as const;

/**
 * Formulario de subida de CSV de precios (un archivo por activo). Pide los datos que el
 * archivo no trae y muestra el resultado: filas guardadas, ya guardadas e inválidas.
 */
export function ImportForm() {
  const [state, formAction, pending] = useActionState<ImportFormState, FormData>(importCsv, { result: null, error: null });
  const result = state.result;

  return (
    <section className="panel" aria-labelledby="import-title">
      <h2 id="import-title">Importar un CSV</h2>
      <p className="panel__help">
        Un archivo por activo, con columnas Date, Open, High, Low, Close, Volume y Symbol (Adj Close es opcional). Volver a
        subir el mismo archivo no duplica precios.
      </p>
      {/* La `key` vuelve a montar el formulario con lo escrito cuando hubo error (React lo limpia al enviar). */}
      <form action={formAction} className="import-form" key={state.error ?? "ok"}>
        <label className="field import-form__file">
          <span>Archivo CSV</span>
          <input type="file" name="file" accept=".csv,text/csv" required />
        </label>
        <label className="field">
          <span>Nombre del activo</span>
          <input name="name" defaultValue={state.values?.name} required placeholder="Apple Inc." />
        </label>
        <label className="field">
          <span>Mercado</span>
          <input name="market" defaultValue={state.values?.market} required placeholder="NASDAQ" />
        </label>
        <label className="field">
          <span>Categoría</span>
          <input name="category" defaultValue={state.values?.category} required placeholder="Acción" />
        </label>
        <label className="field">
          <span>Moneda</span>
          <input name="currency" defaultValue={state.values?.currency} required maxLength={3} placeholder="USD" />
        </label>
        <label className="field">
          <span>Símbolo (opcional)</span>
          <input name="symbol" defaultValue={state.values?.symbol} placeholder="Solo si el CSV no tiene columna Symbol" />
        </label>
        <button type="submit" className="button button--small import-form__submit" disabled={pending} aria-busy={pending}>
          {pending ? "Importando…" : "Importar"}
        </button>
      </form>

      {state.error && (
        <p className="notice notice--error" role="alert">
          {state.error}
        </p>
      )}
      {result && (
        <div className={`notice ${result.status === "failed" ? "notice--error" : ""}`} role="status">
          <p>
            <strong>{STATUS_TEXT[result.status]}</strong>
            {result.symbol ? ` · ${result.symbol}` : ""}
          </p>
          <p>
            {result.inserted} guardadas · {result.already_stored} ya estaban guardadas · {result.invalid_count} inválidas
            {result.file_duplicates_count > 0 ? ` · ${result.file_duplicates_count} repetidas en el archivo` : ""}
          </p>
          {result.invalid.length > 0 && (
            <ul className="import-form__issues">
              {result.invalid.map((issue) => (
                <li key={issue.line}>
                  Línea {issue.line}: {issue.message}
                </li>
              ))}
              {result.invalid_count > result.invalid.length && <li>… y {result.invalid_count - result.invalid.length} más.</li>}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

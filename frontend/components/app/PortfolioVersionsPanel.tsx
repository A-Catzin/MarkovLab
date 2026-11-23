"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { duplicatePortfolioAction } from "@/app/app/carteras/actions";
import { formatMoney, formatPercent, formatWeightPercent } from "@/lib/formatters";
import type { ValidationIssue } from "@/lib/modules/runtime";
import type { PortfolioEditData } from "@/lib/modules/types";
import { validateDuplicationName } from "@/lib/modules/validators";
import { ErrorSummary } from "./ModuleStateViews";
import styles from "./modules.module.css";

export function PortfolioVersionsPanel({ data }: { data: PortfolioEditData }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [sourceName, setSourceName] = useState(data.portfolioName);
  const [duplicateName, setDuplicateName] = useState(`${data.portfolioName} (copia)`);
  const [dupIssues, setDupIssues] = useState<ValidationIssue[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  const [duplicating, setDuplicating] = useState(false);
  const [dupStatus, setDupStatus] = useState<{ text: string; newId?: string } | null>(null);

  function openDuplicateDialog(versionName: string) {
    setSourceName(versionName);
    setDuplicateName(`${versionName} (copia)`);
    setDupIssues([]);
    setDupStatus(null);
    dialogRef.current?.showModal();
  }

  async function handleConfirmDuplicate(event: React.FormEvent) {
    event.preventDefault();
    const existing = data.versions.map((v) => v.name);
    const issues = validateDuplicationName(duplicateName, existing);
    if (issues.length > 0) {
      setDupIssues(issues);
      setFocusKey((k) => k + 1);
      return;
    }
    setDupIssues([]);

    if (data.pendingBackend) {
      dialogRef.current?.close();
      setDupStatus({
        text: `Copia "${duplicateName.trim()}" validada sin alterar "${sourceName}". La creación persistida depende de la entrega B3 del backend; no se simuló escritura.`,
      });
      return;
    }

    setDuplicating(true);
    const res = await duplicatePortfolioAction(data.portfolioId, duplicateName.trim());
    setDuplicating(false);
    if (!res.ok) {
      setDupIssues([{ field: "duplicate-name", message: res.error ?? "No se pudo duplicar la cartera." }]);
      setFocusKey((k) => k + 1);
      return;
    }
    dialogRef.current?.close();
    setDupStatus({
      text: `Se creó la cartera independiente "${res.newName ?? duplicateName.trim()}" sin modificar "${sourceName}".`,
      newId: res.newPortfolioId,
    });
    router.refresh();
  }

  return (
    <section className="panel" aria-labelledby="versions-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="versions-title">Versiones y duplicación de la cartera (RF-32 y RF-33)</h2>
          <p className="panel__help">
            Cada edición registra una nueva versión derivada para comparar rendimiento y riesgo estimado sin perder el
            historial previo. Duplicar genera una copia aparte sin modificar la cartera de origen.
          </p>
        </div>
        <button
          type="button"
          className="button button--small button--quiet"
          onClick={() => openDuplicateDialog(data.portfolioName)}
        >
          Duplicar cartera
        </button>
      </div>

      {dupStatus && (
        <p className="notice" role="status">
          {dupStatus.text}{" "}
          {dupStatus.newId && (
            <Link href={`/app/carteras/${dupStatus.newId}`} className="link">
              Abrir copia
            </Link>
          )}
        </p>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Versión</th>
              <th scope="col">Origen</th>
              <th scope="col" className="num">Capital</th>
              <th scope="col" className="num">Retorno est. (anual)</th>
              <th scope="col" className="num">Riesgo est. (vol.)</th>
              <th scope="col">Composición</th>
              <th scope="col" className="data-table__action">Acción</th>
            </tr>
          </thead>
          <tbody>
            {data.versions.map((version) => (
              <tr key={version.id}>
                <th scope="row">
                  {version.name}
                  <span className="data-table__hint" style={{ display: "block" }}>
                    v{version.versionNumber}
                    {version.isCurrent ? " (actual)" : ""} · {version.createdAt} · ref. {version.startDate}
                  </span>
                </th>
                <td>
                  {version.derivedFromName ? `Derivada de ${version.derivedFromName}` : "Versión inicial"}
                </td>
                <td className="num">{formatMoney(version.capital, version.currency)}</td>
                <td className="num">{formatPercent(version.estimatedAnnualReturn, { signed: true })}</td>
                <td className="num">{formatPercent(version.estimatedAnnualVolatility)}</td>
                <td>
                  <span className="data-table__hint">
                    {version.positions.map((p) => `${p.symbol} ${formatWeightPercent(p.weight)}`).join(" · ")}
                  </span>
                </td>
                <td className="data-table__action">
                  <button
                    type="button"
                    className="button button--small button--quiet"
                    onClick={() => openDuplicateDialog(data.portfolioName)}
                  >
                    Duplicar v{version.versionNumber}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dialog ref={dialogRef} className={styles.modalDialog} aria-labelledby="dup-dialog-title">
        <h2 id="dup-dialog-title">Duplicar sin alterar la cartera original</h2>
        <p className="panel__help">
          Se creará una cartera independiente a partir de <strong>{sourceName}</strong>. El registro original y sus
          simulaciones permanecerán intactos.
        </p>
        <form onSubmit={handleConfirmDuplicate} className={styles.modalBody} noValidate>
          <label className="field" htmlFor="duplicate-name">
            <span>Nombre de la copia nueva</span>
            <input
              id="duplicate-name"
              value={duplicateName}
              maxLength={120}
              onChange={(e) => setDuplicateName(e.target.value)}
            />
          </label>
          <ErrorSummary issues={dupIssues} focusKey={focusKey} />
          <div className={styles.actionRow}>
            <button type="submit" className="button button--small" disabled={duplicating} aria-busy={duplicating}>
              {duplicating
                ? "Duplicando…"
                : data.pendingBackend
                  ? "Validar duplicación"
                  : "Confirmar duplicación"}
            </button>
            <button
              type="button"
              className="button button--small button--quiet"
              onClick={() => dialogRef.current?.close()}
            >
              Cancelar
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
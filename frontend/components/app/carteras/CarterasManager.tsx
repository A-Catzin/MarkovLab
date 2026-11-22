"use client";

import { useState, useEffect } from "react";
import {
  type Portfolio,
  type Currency,
  type PortfolioAsset,
  DEMO_PORTFOLIOS,
  readPortfolios,
  writePortfolios,
  createId,
  todayISO,
  duplicatePortfolio,
  createNewVersion,
  formatMoney,
  portfolioMetrics,
} from "@/lib/portfolios";
import { PortfolioCard } from "./PortfolioCard";
import { PortfolioDetail } from "./PortfolioDetail";
import { PortfolioForm } from "./PortfolioForm";

type ViewMode = "list" | "detail" | "create" | "edit" | "new_version";

export function CarterasManager() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>(DEMO_PORTFOLIOS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Carga inicial desde localStorage
  useEffect(() => {
    const saved = readPortfolios();
    if (saved && saved.length > 0) {
      setPortfolios(saved);
    } else if (saved === null) {
      // Primera visita: guardar los demos para que persistan
      writePortfolios(DEMO_PORTFOLIOS);
    }
  }, []);

  function showToast(message: string) {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  }

  const selectedPortfolio = portfolios.find((p) => p.id === selectedId) ?? null;

  // Acciones sobre carteras
  function handleSelectPortfolio(portfolio: Portfolio) {
    setSelectedId(portfolio.id);
    setViewMode("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBackToList() {
    setSelectedId(null);
    setEditingPortfolio(null);
    setViewMode("list");
  }

  function handleStartCreate() {
    setEditingPortfolio(null);
    setViewMode("create");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleStartEdit(portfolio: Portfolio) {
    setEditingPortfolio(portfolio);
    setViewMode("edit");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleStartNewVersion(portfolio: Portfolio) {
    setEditingPortfolio(portfolio);
    setViewMode("new_version");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleDuplicate(portfolio: Portfolio) {
    const duplicated = duplicatePortfolio(portfolio);
    const updated = [duplicated, ...portfolios];
    setPortfolios(updated);
    writePortfolios(updated);
    showToast(`Se creó una copia de "${portfolio.name}".`);
  }

  function handleDelete(portfolio: Portfolio) {
    const confirmed = window.confirm(
      `¿Deseas eliminar la cartera "${portfolio.name}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    const updated = portfolios.filter((p) => p.id !== portfolio.id);
    setPortfolios(updated);
    writePortfolios(updated);
    if (selectedId === portfolio.id) {
      setSelectedId(null);
      setViewMode("list");
    }
    showToast(`Cartera "${portfolio.name}" eliminada.`);
  }

  function handleResetDemos() {
    const confirmed = window.confirm(
      "¿Deseas restaurar las carteras de ejemplo originales de MarkovLab?",
    );
    if (!confirmed) return;

    setPortfolios(DEMO_PORTFOLIOS);
    writePortfolios(DEMO_PORTFOLIOS);
    setSelectedId(null);
    setViewMode("list");
    showToast("Carteras de ejemplo restauradas.");
  }

  function handleSaveForm(data: {
    name: string;
    capital: number;
    currency: Currency;
    assets: PortfolioAsset[];
    note?: string;
  }) {
    const now = todayISO();

    if (viewMode === "create") {
      const newPortfolio: Portfolio = {
        id: createId(),
        name: data.name,
        capital: data.capital,
        currency: data.currency,
        createdAt: now,
        updatedAt: now,
        version: 1,
        assets: data.assets,
        versions: [
          {
            version: 1,
            createdAt: now,
            note: "Versión inicial",
            capital: data.capital,
            currency: data.currency,
            assets: data.assets,
            metrics: portfolioMetrics(data.assets),
          },
        ],
      };
      const updated = [newPortfolio, ...portfolios];
      setPortfolios(updated);
      writePortfolios(updated);
      setSelectedId(newPortfolio.id);
      setViewMode("detail");
      showToast(`Cartera "${newPortfolio.name}" creada con éxito.`);
    } else if (viewMode === "new_version" && editingPortfolio) {
      const updatedVersion = createNewVersion(editingPortfolio, {
        name: data.name,
        capital: data.capital,
        currency: data.currency,
        assets: data.assets,
        note: data.note,
      });
      const updated = portfolios.map((p) =>
        p.id === editingPortfolio.id ? updatedVersion : p,
      );
      setPortfolios(updated);
      writePortfolios(updated);
      setSelectedId(updatedVersion.id);
      setViewMode("detail");
      showToast(`Nueva versión v${updatedVersion.version} guardada.`);
    } else if (viewMode === "edit" && editingPortfolio) {
      const updatedItem: Portfolio = {
        ...editingPortfolio,
        name: data.name,
        capital: data.capital,
        currency: data.currency,
        updatedAt: now,
        assets: data.assets,
      };
      const updated = portfolios.map((p) =>
        p.id === editingPortfolio.id ? updatedItem : p,
      );
      setPortfolios(updated);
      writePortfolios(updated);
      setSelectedId(updatedItem.id);
      setViewMode("detail");
      showToast(`Cambios guardados en "${updatedItem.name}".`);
    }
  }

  // Cálculos para la barra de resumen
  const totalPortfoliosCount = portfolios.length;
  const totalCapitalMXN = portfolios
    .filter((p) => p.currency === "MXN")
    .reduce((sum, p) => sum + p.capital, 0);
  const totalCapitalUSD = portfolios
    .filter((p) => p.currency === "USD")
    .reduce((sum, p) => sum + p.capital, 0);

  return (
    <div className="carteras-manager">
      {/* Toast de confirmación accesible */}
      {toastMessage ? (
        <div className="portfolio-toast" role="status" aria-live="polite">
          <span>{toastMessage}</span>
        </div>
      ) : null}

      {/* Vista de formulario (Crear / Editar / Nueva versión) */}
      {viewMode === "create" || viewMode === "edit" || viewMode === "new_version" ? (
        <div className="app-page">
          <header>
            <h1>
              {viewMode === "create" ? "Nueva cartera" : viewMode === "new_version" ? "Nueva versión" : "Editar cartera"}
            </h1>
          </header>
          <PortfolioForm
            initialPortfolio={editingPortfolio}
            mode={viewMode}
            onSave={handleSaveForm}
            onCancel={() => {
              if (selectedId) setViewMode("detail");
              else setViewMode("list");
            }}
          />
        </div>
      ) : null}

      {/* Vista de detalle de cartera */}
      {viewMode === "detail" && selectedPortfolio ? (
        <PortfolioDetail
          portfolio={selectedPortfolio}
          onBack={handleBackToList}
          onEdit={handleStartEdit}
          onNewVersion={handleStartNewVersion}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      ) : null}

      {/* Vista de lista de carteras */}
      {viewMode === "list" ? (
        <div className="app-page">
          <header className="carteras-header">
            <div>
              <h1>Mis carteras</h1>
              <p className="app-page__lead">
                Crea carteras con tus propios activos y pesos, guarda varias versiones para comparar
                decisiones y analiza su rendimiento y riesgo antes de simular.
              </p>
            </div>

            <div className="carteras-header__actions">
              <button
                type="button"
                className="button"
                onClick={handleStartCreate}
              >
                + Nueva cartera
              </button>
            </div>
          </header>

          {/* Resumen del módulo */}
          <div className="app-page__summary" aria-label="Resumen de carteras">
            <div>
              <strong>{totalPortfoliosCount}</strong>
              <span>{totalPortfoliosCount === 1 ? "cartera activa" : "carteras activas"}</span>
            </div>
            <div>
              <strong>{formatMoney(totalCapitalMXN, "MXN")}</strong>
              <span>en carteras MXN</span>
            </div>
            <div>
              <strong>
                {totalCapitalUSD > 0 ? formatMoney(totalCapitalUSD, "USD") : "100 %"}
              </strong>
              <span>{totalCapitalUSD > 0 ? "en carteras USD" : "ponderación validada"}</span>
            </div>
          </div>

          {/* Toolbar de acciones secundarias */}
          <div className="carteras-toolbar">
            <span className="muted">
              {totalPortfoliosCount} {totalPortfoliosCount === 1 ? "cartera disponible" : "carteras disponibles"}
            </span>

            <button
              type="button"
              className="link carteras-toolbar__reset"
              onClick={handleResetDemos}
              title="Restaurar las 3 carteras de ejemplo iniciales"
            >
              Restaurar carteras de ejemplo
            </button>
          </div>

          {/* Grilla de carteras */}
          {portfolios.length > 0 ? (
            <div className="portfolio-grid" aria-label="Lista de carteras de inversión">
              {portfolios.map((portfolio) => (
                <PortfolioCard
                  key={portfolio.id}
                  portfolio={portfolio}
                  onSelect={handleSelectPortfolio}
                  onEdit={handleStartEdit}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="ui-panel carteras-empty">
              <h2>No tienes carteras guardadas</h2>
              <p className="muted">
                Crea una cartera personalizada o restaura las de ejemplo para empezar a analizar.
              </p>
              <div className="carteras-empty__actions">
                <button
                  type="button"
                  className="button"
                  onClick={handleStartCreate}
                >
                  Crear mi primera cartera
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={handleResetDemos}
                >
                  Cargar carteras de ejemplo
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

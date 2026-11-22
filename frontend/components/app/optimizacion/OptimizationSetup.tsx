"use client";

import {
  type OptimizationObjective,
  type OptimizationConstraints,
} from "@/lib/optimizer";
import { type Portfolio, formatMoney } from "@/lib/portfolios";

interface OptimizationSetupProps {
  portfolios: Portfolio[];
  selectedPortfolioId: string;
  onSelectPortfolioId: (id: string) => void;
  objective: OptimizationObjective;
  onSelectObjective: (obj: OptimizationObjective) => void;
  constraints: OptimizationConstraints;
  onChangeConstraints: (constraints: OptimizationConstraints) => void;
  onRunOptimization: () => void;
  isOptimizing: boolean;
  feasibilityError?: string;
}

export function OptimizationSetup({
  portfolios,
  selectedPortfolioId,
  onSelectPortfolioId,
  objective,
  onSelectObjective,
  constraints,
  onChangeConstraints,
  onRunOptimization,
  isOptimizing,
  feasibilityError,
}: OptimizationSetupProps) {
  const selectedPortfolio = portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0];

  function handleMinChange(val: number) {
    const clamped = Math.max(0, Math.min(val, constraints.maxWeight));
    onChangeConstraints({ ...constraints, minWeight: clamped });
  }

  function handleMaxChange(val: number) {
    const clamped = Math.max(constraints.minWeight, Math.min(100, val));
    onChangeConstraints({ ...constraints, maxWeight: clamped });
  }

  return (
    <div className="ui-panel opt-setup" data-ui>
      <div className="ui-panel__top">
        <h2 className="ui-panel__name">Configuración de la optimización</h2>
        <span className="ui-tag">Teoría de Markowitz</span>
      </div>

      <p className="ui-note">
        Selecciona una cartera base, el objetivo cuantitativo y los límites de diversificación por
        activo. El algoritmo calculará la combinación matemáticamente óptima.
      </p>

      {/* Selector de Cartera Fuente */}
      <div className="opt-setup__portfolio-select">
        <label className="opt-setup__label">
          <span>Cartera a optimizar:</span>
          <select
            value={selectedPortfolioId}
            onChange={(e) => onSelectPortfolioId(e.target.value)}
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.assets.length} activos · {formatMoney(p.capital, p.currency)})
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Selección de Objetivo Matemático (RF-34, RF-35) */}
      <div className="opt-setup__objectives" role="radiogroup" aria-label="Objetivo de optimización">
        <div className="opt-setup__section-title">Objetivo cuantitativo</div>
        <div className="opt-setup__cards">
          <button
            type="button"
            className={`opt-objective-card ${objective === "min_variance" ? "opt-objective-card--active" : ""}`}
            onClick={() => onSelectObjective("min_variance")}
            role="radio"
            aria-checked={objective === "min_variance"}
          >
            <div className="opt-objective-card__body">
              <div className="opt-objective-card__head">
                <strong>Mínima varianza</strong>
                <span className="ui-tag">Mínimo riesgo</span>
              </div>
              <span>
                Minimiza el riesgo y la oscilación de la cartera mediante la correlación entre activos.
                Ideal para perfiles conservadores.
              </span>
            </div>
          </button>

          <button
            type="button"
            className={`opt-objective-card ${objective === "max_sharpe" ? "opt-objective-card--active" : ""}`}
            onClick={() => onSelectObjective("max_sharpe")}
            role="radio"
            aria-checked={objective === "max_sharpe"}
          >
            <div className="opt-objective-card__body">
              <div className="opt-objective-card__head">
                <strong>Máximo ratio de Sharpe</strong>
                <span className="ui-tag">Mayor eficiencia</span>
              </div>
              <span>
                Encuentra la cartera tangente que maximiza la rentabilidad obtenida por cada unidad de
                riesgo asumida (tasa libre de riesgo 4.5 %).
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Restricciones por activo (RF-36) */}
      <div className="opt-setup__constraints">
        <div className="opt-setup__section-title">Restricciones de ponderación por activo (RF-36)</div>

        <div className="opt-setup__constraint-row">
          <label className="opt-setup__field">
            <span>Peso mínimo por activo: {constraints.minWeight} %</span>
            <div className="opt-setup__slider-group">
              <input
                type="range"
                min={0}
                max={25}
                step={1}
                value={constraints.minWeight}
                onChange={(e) => handleMinChange(Number(e.target.value))}
              />
              <output>{constraints.minWeight} %</output>
            </div>
            <small className="muted">Garantiza exposición mínima a cada empresa.</small>
          </label>

          <label className="opt-setup__field">
            <span>Peso máximo por activo: {constraints.maxWeight} %</span>
            <div className="opt-setup__slider-group">
              <input
                type="range"
                min={25}
                max={100}
                step={5}
                value={constraints.maxWeight}
                onChange={(e) => handleMaxChange(Number(e.target.value))}
              />
              <output>{constraints.maxWeight} %</output>
            </div>
            <small className="muted">Evita concentración excesiva en un solo activo.</small>
          </label>
        </div>

        {/* Validación de factibilidad (RF-39) */}
        {feasibilityError ? (
          <div className="opt-feasibility-error" role="alert">
            <strong>Restricciones incompatibles (sin solución):</strong>
            <p>{feasibilityError}</p>
          </div>
        ) : (
          <div className="opt-feasibility-ok">
            <span>Restricciones factibles para los {selectedPortfolio?.assets.length ?? 0} activos seleccionados.</span>
          </div>
        )}
      </div>

      {/* Botón de Ejecución */}
      <div className="opt-setup__actions">
        <button
          type="button"
          className="button opt-setup__run-btn"
          disabled={Boolean(feasibilityError) || isOptimizing}
          onClick={onRunOptimization}
        >
          {isOptimizing ? "Optimizando..." : "Calcular cartera óptima"}
        </button>
      </div>
    </div>
  );
}

"use client";

import {
  type BacktestHorizon,
  type RebalanceFrequency,
} from "@/lib/backtesting";
import { type Portfolio, formatMoney } from "@/lib/portfolios";

interface BacktestSetupProps {
  portfolios: Portfolio[];
  selectedPortfolioId: string;
  onSelectPortfolioId: (id: string) => void;
  horizonDays: BacktestHorizon;
  onSelectHorizonDays: (horizon: BacktestHorizon) => void;
  rebalanceFrequency: RebalanceFrequency;
  onSelectRebalanceFrequency: (freq: RebalanceFrequency) => void;
  benchmarkTicker: string;
  onSelectBenchmarkTicker: (ticker: string) => void;
  capital: number;
  onChangeCapital: (capital: number) => void;
  onRunBacktest: () => void;
  isRunning: boolean;
}

export function BacktestSetup({
  portfolios,
  selectedPortfolioId,
  onSelectPortfolioId,
  horizonDays,
  onSelectHorizonDays,
  rebalanceFrequency,
  onSelectRebalanceFrequency,
  benchmarkTicker,
  onSelectBenchmarkTicker,
  capital,
  onChangeCapital,
  onRunBacktest,
  isRunning,
}: BacktestSetupProps) {
  const selectedPortfolio =
    portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0];

  return (
    <div className="ui-panel bt-setup" data-ui>
      <div className="ui-panel__top">
        <h2 className="ui-panel__name">Configuración del backtesting histórico</h2>
        <span className="ui-tag">Evaluación fuera de muestra</span>
      </div>

      <p className="ui-note">
        Evalúa el desempeño de tu cartera día a día a lo largo del período elegido, ajustando la frecuencia de
        rebalanceo y comparando el resultado frente a un índice de referencia.
      </p>

      <div className="ui-fields bt-setup__fields">
        {/* Cartera a evaluar */}
        <label>
          Cartera a evaluar
          <select
            value={selectedPortfolioId}
            onChange={(e) => onSelectPortfolioId(e.target.value)}
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.assets.length} activos · v{p.version})
              </option>
            ))}
          </select>
        </label>

        {/* Período histórico (RF-49) */}
        <label>
          Período histórico analizado
          <select
            value={horizonDays}
            onChange={(e) => onSelectHorizonDays(Number(e.target.value) as BacktestHorizon)}
          >
            <option value={252}>1 año (252 días bursátiles)</option>
            <option value={756}>3 años (756 días bursátiles)</option>
            <option value={1260}>5 años (1,260 días bursátiles)</option>
          </select>
        </label>

        {/* Frecuencia de rebalanceo (RF-50) */}
        <label>
          Frecuencia de rebalanceo
          <select
            value={rebalanceFrequency}
            onChange={(e) => onSelectRebalanceFrequency(e.target.value as RebalanceFrequency)}
          >
            <option value="monthly">Mensual (cada 21 días)</option>
            <option value="quarterly">Trimestral (cada 63 días)</option>
            <option value="annual">Anual (cada 252 días)</option>
            <option value="buy_and_hold">Comprar y mantener (sin rebalanceo)</option>
          </select>
        </label>

        {/* Índice de referencia / Benchmark (RF-52) */}
        <label>
          Índice de referencia (Benchmark)
          <select
            value={benchmarkTicker}
            onChange={(e) => onSelectBenchmarkTicker(e.target.value)}
          >
            <option value="SPY">SPY — S&P 500 ETF (Renta Variable EE. UU.)</option>
            <option value="BND">BND — Total Bond ETF (Renta Fija)</option>
          </select>
        </label>
      </div>

      <div className="bt-setup__bottom">
        <label className="bt-setup__capital-field">
          <span>Capital inicial ({selectedPortfolio?.currency ?? "MXN"})</span>
          <input
            type="number"
            min={100}
            step="any"
            value={Number.isNaN(capital) ? "" : capital}
            onChange={(e) => onChangeCapital(Number.parseFloat(e.target.value) || 0)}
          />
        </label>

        <button
          type="button"
          className="button bt-setup__run-btn"
          disabled={isRunning || capital <= 0}
          onClick={onRunBacktest}
        >
          {isRunning ? "Simulando..." : "Ejecutar backtesting histórico"}
        </button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  runBacktest,
  saveBacktest,
  type BacktestHorizon,
  type BacktestResult,
  type RebalanceFrequency,
} from "@/lib/backtesting";
import { DEMO_PORTFOLIOS, readPortfolios, type Portfolio } from "@/lib/portfolios";
import { BacktestSetup } from "./BacktestSetup";
import { BacktestResults } from "./BacktestResults";

/**
 * Orquesta el backtesting: elige una cartera guardada, configura el período y
 * ejecuta la evaluación día a día contra un índice de referencia (RF-49 a RF-53).
 */
export function BacktestManager() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>(DEMO_PORTFOLIOS);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(DEMO_PORTFOLIOS[0].id);
  const [horizonDays, setHorizonDays] = useState<BacktestHorizon>(756);
  const [rebalanceFrequency, setRebalanceFrequency] = useState<RebalanceFrequency>("monthly");
  const [benchmarkTicker, setBenchmarkTicker] = useState("SPY");
  const [capital, setCapital] = useState<number>(DEMO_PORTFOLIOS[0].capital);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = readPortfolios();
    if (stored && stored.length > 0) {
      setPortfolios(stored);
      setSelectedPortfolioId(stored[0].id);
      setCapital(stored[0].capital);
    }
  }, []);

  const selectedPortfolio =
    portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? portfolios[0] ?? null;

  function showToast(message: string) {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  }

  function clearResult() {
    setResult(null);
    setSaved(false);
  }

  function handleSelectPortfolio(id: string) {
    setSelectedPortfolioId(id);
    const portfolio = portfolios.find((item) => item.id === id);
    if (portfolio) setCapital(portfolio.capital);
    clearResult();
  }

  function run() {
    if (!selectedPortfolio || !Number.isFinite(capital) || capital <= 0) return;
    setIsRunning(true);
    // Un respiro para que el botón alcance a mostrar "Simulando..." antes del cálculo.
    setTimeout(() => {
      try {
        const next = runBacktest({
          portfolio: selectedPortfolio,
          benchmarkTicker,
          horizonDays,
          rebalanceFrequency,
          initialCapital: capital,
        });
        setResult(next);
        setSaved(false);
      } catch (error) {
        console.error("Error al ejecutar el backtesting", error);
        showToast("No se pudo ejecutar el backtesting. Revisa la configuración.");
      } finally {
        setIsRunning(false);
      }
    }, 60);
  }

  function handleSave() {
    if (!result || !selectedPortfolio || saved) return;
    saveBacktest(result, selectedPortfolio.id);
    setSaved(true);
    showToast("Resultado guardado con sus parámetros en este navegador.");
  }

  if (portfolios.length === 0) {
    return (
      <div className="app-page bt-page">
        <header>
          <h1>Backtesting</h1>
          <p className="app-page__lead">
            Prueba una cartera con precios del pasado y compárala contra un índice de referencia.
          </p>
        </header>
        <div className="ui-panel bt-empty" data-ui>
          <p className="ui-panel__name">Primero necesitas una cartera</p>
          <p className="muted">
            El backtesting evalúa una cartera guardada. Crea una en el módulo de carteras y vuelve aquí.
          </p>
          <Link className="button" href="/app/carteras">
            Ir a mis carteras
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page bt-page">
      {toastMessage ? (
        <div className="portfolio-toast" role="status" aria-live="polite">
          <span>{toastMessage}</span>
        </div>
      ) : null}

      <header>
        <h1>Backtesting</h1>
        <p className="app-page__lead">
          Recorre el pasado día a día con tu cartera: rebalancea con la frecuencia que elijas y compara el resultado
          contra un índice de referencia para ver si la estrategia habría funcionado.
        </p>
      </header>

      <BacktestSetup
        portfolios={portfolios}
        selectedPortfolioId={selectedPortfolioId}
        onSelectPortfolioId={handleSelectPortfolio}
        horizonDays={horizonDays}
        onSelectHorizonDays={(horizon) => {
          setHorizonDays(horizon);
          clearResult();
        }}
        rebalanceFrequency={rebalanceFrequency}
        onSelectRebalanceFrequency={(frequency) => {
          setRebalanceFrequency(frequency);
          clearResult();
        }}
        benchmarkTicker={benchmarkTicker}
        onSelectBenchmarkTicker={(ticker) => {
          setBenchmarkTicker(ticker);
          clearResult();
        }}
        capital={capital}
        onChangeCapital={(value) => {
          setCapital(value);
          clearResult();
        }}
        onRunBacktest={run}
        isRunning={isRunning}
      />

      {result && selectedPortfolio ? (
        <BacktestResults result={result} portfolio={selectedPortfolio} saved={saved} onSave={handleSave} />
      ) : null}

      <p className="bt-footnote">
        Los precios son simulaciones deterministas con las cifras de ejemplo del navegador, no cotizaciones reales: con
        la misma semilla se obtiene exactamente la misma trayectoria. Cuando la API de MarkovLab esté lista, el
        backtesting usará precios históricos importados de CSV y separará los datos de configuración de los de
        evaluación.
      </p>
    </div>
  );
}

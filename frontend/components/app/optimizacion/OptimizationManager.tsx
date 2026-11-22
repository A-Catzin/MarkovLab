"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  type OptimizationObjective,
  type OptimizationConstraints,
  type OptimizationResult,
  type EfficientFrontierPoint,
  optimizePortfolio,
  computeEfficientFrontier,
  validateConstraintsFeasibility,
} from "@/lib/optimizer";
import {
  type Portfolio,
  DEMO_PORTFOLIOS,
  readPortfolios,
  writePortfolios,
  createId,
  todayISO,
  createNewVersion,
  portfolioMetrics,
} from "@/lib/portfolios";
import { SAMPLE_ASSETS } from "@/lib/landing-data";
import { OptimizationSetup } from "./OptimizationSetup";
import { OptimizationComparison } from "./OptimizationComparison";
import { EfficientFrontierChart } from "./EfficientFrontierChart";

export function OptimizationManager() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<Portfolio[]>(DEMO_PORTFOLIOS);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(DEMO_PORTFOLIOS[0].id);
  const [objective, setObjective] = useState<OptimizationObjective>("max_sharpe");
  const [constraints, setConstraints] = useState<OptimizationConstraints>({
    minWeight: 0,
    maxWeight: 100,
    riskFreeRate: 0.045,
  });

  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [frontierPoints, setFrontierPoints] = useState<EfficientFrontierPoint[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Cargar carteras guardadas de localStorage
  useEffect(() => {
    const saved = readPortfolios();
    if (saved && saved.length > 0) {
      setPortfolios(saved);
      setSelectedPortfolioId(saved[0].id);
    }
  }, []);

  const selectedPortfolio =
    portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0] ?? DEMO_PORTFOLIOS[0];

  // Validación de factibilidad en tiempo real
  const feasibility = useMemo(() => {
    const assetCount = selectedPortfolio?.assets.length ?? 0;
    return validateConstraintsFeasibility(assetCount, constraints);
  }, [selectedPortfolio, constraints]);

  // Ejecutar optimización y cálculo de frontera
  function runOptimization() {
    if (!selectedPortfolio || !feasibility.feasible) return;

    setIsOptimizing(true);
    try {
      const optResult = optimizePortfolio(selectedPortfolio.assets, objective, constraints);
      setResult(optResult);

      const frontier = computeEfficientFrontier(selectedPortfolio.assets, 24);
      setFrontierPoints(frontier);
    } catch (err) {
      console.error("Error al optimizar", err);
    } finally {
      setIsOptimizing(false);
    }
  }

  // Ejecutar automáticamente al cambiar de cartera o de objetivo. Las restricciones
  // se aplican al pulsar "Calcular cartera óptima", por eso no están en las dependencias.
  useEffect(() => {
    if (selectedPortfolio && feasibility.feasible) {
      runOptimization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPortfolioId, objective]);

  function showToast(message: string) {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }

  function handleSaveAsNewPortfolio() {
    if (!result || !selectedPortfolio) return;

    const now = todayISO();
    const newName = `${selectedPortfolio.name} (Optimizada)`;
    const newPortfolio: Portfolio = {
      id: createId(),
      name: newName,
      capital: selectedPortfolio.capital,
      currency: selectedPortfolio.currency,
      description: `Cartera generada mediante optimización (${result.objective === "min_variance" ? "Mínima varianza" : "Máximo Sharpe"}) a partir de ${selectedPortfolio.name}.`,
      createdAt: now,
      updatedAt: now,
      version: 1,
      assets: result.assets,
      versions: [
        {
          version: 1,
          createdAt: now,
          note: `Optimización ${result.objective === "min_variance" ? "Mínima varianza" : "Máximo Sharpe"}`,
          capital: selectedPortfolio.capital,
          currency: selectedPortfolio.currency,
          assets: result.assets,
          metrics: result.metrics,
        },
      ],
    };

    const updated = [newPortfolio, ...portfolios];
    setPortfolios(updated);
    writePortfolios(updated);
    showToast(`Se guardó "${newName}" en Mis carteras.`);
  }

  function handleSaveAsNewVersion() {
    if (!result || !selectedPortfolio) return;

    const note = `Optimización ${result.objective === "min_variance" ? "Mínima varianza" : "Máximo Sharpe"} (pesos recalculados)`;
    const updatedVersion = createNewVersion(selectedPortfolio, {
      assets: result.assets,
      note,
    });

    const updated = portfolios.map((p) =>
      p.id === selectedPortfolio.id ? updatedVersion : p,
    );
    setPortfolios(updated);
    writePortfolios(updated);
    showToast(`Se guardó la versión v${updatedVersion.version} de "${selectedPortfolio.name}".`);
  }

  function handleSimulate() {
    if (!result || !selectedPortfolio) return;
    const weightsParam = result.assets.map((a) => a.weight).join(",");
    const url = `/app/simulador?weights=${encodeURIComponent(weightsParam)}&capital=${selectedPortfolio.capital}&name=${encodeURIComponent(`${selectedPortfolio.name} (Óptima)`)}`;
    router.push(url);
  }

  // Puntos para la Frontera Eficiente
  const currentMetrics = selectedPortfolio ? portfolioMetrics(selectedPortfolio.assets) : null;
  const currentPoint = currentMetrics
    ? {
        volatility: currentMetrics.annualVolatility,
        returnRate: currentMetrics.annualReturn,
        name: selectedPortfolio.name,
      }
    : null;

  const optimalPoint = result
    ? {
        volatility: result.metrics.annualVolatility,
        returnRate: result.metrics.annualReturn,
        name: "Óptima",
      }
    : null;

  const assetPoints = (selectedPortfolio?.assets ?? []).map((a) => {
    const s = SAMPLE_ASSETS.find((item) => item.ticker === a.ticker);
    return {
      ticker: a.ticker,
      volatility: s?.annualVolatility ?? 0.2,
      returnRate: s?.annualReturn ?? 0.15,
    };
  });

  return (
    <div className="app-page opt-page">
      {/* Toast flotante */}
      {toastMessage ? (
        <div className="portfolio-toast" role="status" aria-live="polite">
          <span>{toastMessage}</span>
        </div>
      ) : null}

      <header>
        <h1>Optimización de carteras</h1>
        <p className="app-page__lead">
          Calcula la combinación matemáticamente óptima de pesos según el modelo de Markowitz:
          minimiza el riesgo para carteras defensivas o maximiza el ratio de Sharpe para obtener el
          mayor retorno por unidad de volatilidad.
        </p>
      </header>

      {/* Panel de configuración */}
      <OptimizationSetup
        portfolios={portfolios}
        selectedPortfolioId={selectedPortfolioId}
        onSelectPortfolioId={setSelectedPortfolioId}
        objective={objective}
        onSelectObjective={setObjective}
        constraints={constraints}
        onChangeConstraints={setConstraints}
        onRunOptimization={runOptimization}
        isOptimizing={isOptimizing}
        feasibilityError={feasibility.error}
      />

      {/* Resultados de la comparación */}
      {result && selectedPortfolio ? (
        <OptimizationComparison
          originalPortfolio={selectedPortfolio}
          result={result}
          onSaveAsNewPortfolio={handleSaveAsNewPortfolio}
          onSaveAsNewVersion={handleSaveAsNewVersion}
          onSimulate={handleSimulate}
        />
      ) : null}

      {/* Gráfico interactivo de la Frontera Eficiente */}
      {frontierPoints.length > 0 ? (
        <EfficientFrontierChart
          points={frontierPoints}
          currentPoint={currentPoint}
          optimalPoint={optimalPoint}
          assetPoints={assetPoints}
        />
      ) : null}
    </div>
  );
}

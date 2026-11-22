"use client";

import Link from "next/link";
import {
  type BacktestMetrics,
  type BacktestResult,
  type RebalanceFrequency,
} from "@/lib/backtesting";
import { formatMoney, formatPercent, formatSignedPercent, type Currency, type Portfolio } from "@/lib/portfolios";
import { BacktestPerformanceChart } from "./BacktestPerformanceChart";

const REBALANCE_LABELS: Record<RebalanceFrequency, string> = {
  monthly: "rebalanceo mensual",
  quarterly: "rebalanceo trimestral",
  annual: "rebalanceo anual",
  buy_and_hold: "comprar y mantener",
};

const HORIZON_LABELS: Record<number, string> = {
  252: "1 año",
  756: "3 años",
  1260: "5 años",
};

interface BacktestResultsProps {
  result: BacktestResult;
  portfolio: Portfolio;
  saved: boolean;
  onSave: () => void;
}

/** Descarga la serie temporal como CSV (RF-58). */
function downloadCsv(result: BacktestResult) {
  const header = "fecha,valor_cartera,valor_benchmark,drawdown_cartera,drawdown_benchmark";
  const rows = result.series.map((point) =>
    [
      point.date,
      point.portfolioValue.toFixed(2),
      point.benchmarkValue.toFixed(2),
      point.portfolioDrawdown.toFixed(6),
      point.benchmarkDrawdown.toFixed(6),
    ].join(","),
  );
  const blob = new Blob([`${header}\n${rows.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `backtest-${result.benchmarkTicker}-${result.horizonDays}d.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function MetricCard({
  title,
  portfolioValue,
  benchmarkValue,
  hint,
}: {
  title: string;
  portfolioValue: string;
  benchmarkValue: string;
  hint: string;
}) {
  return (
    <div className="bt-metric-card">
      <span className="bt-metric-card__title">{title}</span>
      <div className="bt-metric-card__values">
        <strong className="bt-metric-card__val--portfolio">{portfolioValue}</strong>
        <span className="bt-metric-card__benchmark">vs {benchmarkValue}</span>
      </div>
      <small>{hint}</small>
    </div>
  );
}

function metricRows(pm: BacktestMetrics, bm: BacktestMetrics, currency: Currency) {
  return [
    { label: "Capital inicial", portfolio: formatMoney(pm.initialCapital, currency), benchmark: formatMoney(bm.initialCapital, currency) },
    { label: "Capital final", portfolio: formatMoney(pm.finalCapital, currency), benchmark: formatMoney(bm.finalCapital, currency) },
    { label: "Rendimiento acumulado", portfolio: formatSignedPercent(pm.cumulativeReturn), benchmark: formatSignedPercent(bm.cumulativeReturn) },
    { label: "Crecimiento anual (CAGR)", portfolio: formatSignedPercent(pm.cagr), benchmark: formatSignedPercent(bm.cagr) },
    { label: "Volatilidad anual", portfolio: `±${formatPercent(pm.annualizedVolatility)}`, benchmark: `±${formatPercent(bm.annualizedVolatility)}` },
    { label: "Ratio de Sharpe", portfolio: pm.sharpeRatio.toFixed(2), benchmark: bm.sharpeRatio.toFixed(2) },
    { label: "Máxima caída (drawdown)", portfolio: formatSignedPercent(pm.maxDrawdown), benchmark: formatSignedPercent(bm.maxDrawdown) },
    { label: "Beta vs. índice", portfolio: pm.beta.toFixed(2), benchmark: "1.00" },
    { label: "Alfa de Jensen (anual)", portfolio: formatSignedPercent(pm.alpha), benchmark: "—" },
    { label: "Días con ganancia", portfolio: formatPercent(pm.positiveDaysRatio, 0), benchmark: formatPercent(bm.positiveDaysRatio, 0) },
  ];
}

export function BacktestResults({ result, portfolio, saved, onSave }: BacktestResultsProps) {
  const { portfolioMetrics: pm, benchmarkMetrics: bm, series } = result;
  const currency = result.currency;
  const difference = (pm.cumulativeReturn - bm.cumulativeReturn) * 100;
  const beatBenchmark = difference >= 0;
  const weightsParam = portfolio.assets.map((asset) => asset.weight).join(",");
  const simUrl = `/app/simulador?weights=${encodeURIComponent(weightsParam)}&capital=${result.initialCapital}&name=${encodeURIComponent(portfolio.name)}`;
  const startDate = series[0]?.date ?? "—";
  const endDate = series[series.length - 1]?.date ?? "—";

  return (
    <section className="bt-results" aria-label="Resultado del backtesting">
      <div className="ui-panel" data-ui>
        <div className="ui-panel__top">
          <h2 className="ui-panel__name">Resultado del backtesting</h2>
          <span className="ui-tag ui-tag--done">
            Listo en {Math.max(1, Math.round(result.elapsedMs))} ms
          </span>
        </div>

        <p className="bt-results__summary" aria-live="polite">
          Con {formatMoney(result.initialCapital, currency)} iniciales, tu cartera terminó en{" "}
          <strong>{formatMoney(pm.finalCapital, currency)}</strong> ({formatSignedPercent(pm.cumulativeReturn)}), mientras
          que {result.benchmarkTicker} terminó en <strong>{formatMoney(bm.finalCapital, currency)}</strong> (
          {formatSignedPercent(bm.cumulativeReturn)}).{" "}
          {beatBenchmark
            ? `Tu cartera superó al índice por ${difference.toLocaleString("es-MX", { maximumFractionDigits: 1 })} puntos porcentuales.`
            : `El índice superó a tu cartera por ${Math.abs(difference).toLocaleString("es-MX", { maximumFractionDigits: 1 })} puntos porcentuales.`}
        </p>

        <div className="bt-metric-cards">
          <MetricCard
            title="Rendimiento acumulado"
            portfolioValue={formatSignedPercent(pm.cumulativeReturn)}
            benchmarkValue={formatSignedPercent(bm.cumulativeReturn)}
            hint="Ganancia o pérdida total del período."
          />
          <MetricCard
            title="Volatilidad anual"
            portfolioValue={`±${formatPercent(pm.annualizedVolatility)}`}
            benchmarkValue={`±${formatPercent(bm.annualizedVolatility)}`}
            hint="Qué tanto subió y bajó el valor en un año típico."
          />
          <MetricCard
            title="Ratio de Sharpe"
            portfolioValue={pm.sharpeRatio.toFixed(2)}
            benchmarkValue={bm.sharpeRatio.toFixed(2)}
            hint="Retorno por cada unidad de riesgo (tasa libre de riesgo 4.5 %)."
          />
          <MetricCard
            title="Máxima caída"
            portfolioValue={formatSignedPercent(pm.maxDrawdown)}
            benchmarkValue={formatSignedPercent(bm.maxDrawdown)}
            hint="La peor pérdida desde un pico hasta el fondo siguiente."
          />
        </div>

        <table className="ui-table bt-table">
          <thead>
            <tr>
              <th scope="col">Métrica</th>
              <th scope="col">Tu cartera</th>
              <th scope="col">{result.benchmarkTicker}</th>
            </tr>
          </thead>
          <tbody>
            {metricRows(pm, bm, currency).map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.portfolio}</td>
                <td>{row.benchmark}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="caption">
          Período evaluado: {startDate} a {endDate} ({HORIZON_LABELS[result.horizonDays] ?? `${result.horizonDays} días`},{" "}
          {result.horizonDays.toLocaleString("es-MX")} días bursátiles) · {REBALANCE_LABELS[result.rebalanceFrequency]} ·
          semilla {result.seed}. Fuente: precios simulados con el modelo del navegador, no cotizaciones reales.
        </p>
      </div>

      <BacktestPerformanceChart
        series={series}
        portfolioName={result.portfolioName}
        benchmarkTicker={result.benchmarkTicker}
        currency={currency}
      />

      <div className="bt-results__actions">
        <button className="button" type="button" onClick={onSave} disabled={saved}>
          {saved ? "Resultado guardado" : "Guardar resultado"}
        </button>
        <Link className="button button--secondary" href={simUrl}>
          Simular esta cartera
        </Link>
        <button className="button button--secondary" type="button" onClick={() => downloadCsv(result)}>
          Descargar CSV
        </button>
      </div>
    </section>
  );
}

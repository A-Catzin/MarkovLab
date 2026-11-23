import type { Metadata } from "next";
import Link from "next/link";
import { ExampleDataBanner } from "@/components/app/ModuleStateViews";
import { PredictionView } from "@/components/app/PredictionView";
import { requireUser } from "@/lib/guards";
import { loadPredictionView } from "@/lib/modules/adapters/prediction.server";
import { parseScenario } from "@/lib/modules/runtime";
import type { PredictionMetricKind } from "@/lib/modules/types";

export const metadata: Metadata = {
  title: "Predicción de activos · MarkovLab",
  description: "Pronósticos con banda de incertidumbre, metadatos del modelo y contraste observado.",
};

export default async function PredictionPage({
  searchParams,
}: {
  searchParams: Promise<{
    activo?: string;
    activoId?: string;
    metrica?: string;
    horizonte?: string;
    contraste?: string;
    prediccion?: string;
    escenario?: string;
  }>;
}) {
  const user = await requireUser();
  const q = await searchParams;
  const symbol = q.activo;
  const parsedAssetId = Number(q.activoId);
  const assetId = Number.isInteger(parsedAssetId) && parsedAssetId > 0 ? parsedAssetId : undefined;
  const metric: PredictionMetricKind = q.metrica === "volatility" ? "volatility" : "return";
  const parsedHorizon = Number(q.horizonte);
  const horizonDays: 21 | 63 | 126 = parsedHorizon === 21 || parsedHorizon === 126 ? parsedHorizon : 63;
  const withObserved = q.contraste !== "0";
  const predictionId = q.prediccion;
  const scenario = parseScenario(q.escenario);

  const result = await loadPredictionView({
    actorId: user.id,
    symbol,
    assetId,
    metric,
    horizonDays,
    withObserved,
    predictionId,
    scenario,
  });

  const resolvedSymbol = result.status === "ok" ? result.data.selectedSymbol : symbol ?? "AAPL";
  const resolvedMetric = result.status === "ok" ? result.data.metric : metric;
  const resolvedHorizon = result.status === "ok" ? result.data.horizonDays : horizonDays;
  const viewKey = `${predictionId ?? ""}:${assetId ?? ""}:${resolvedSymbol}:${resolvedMetric}:${resolvedHorizon}:${scenario}`;

  return (
    <>
      <p className="crumbs">
        <Link href="/app">Laboratorio</Link> / Predicción
      </p>
      {result.status === "ok" && result.provenance.isExample && (
        <ExampleDataBanner moduleName="Predicción de activos (F5)" />
      )}
      <PredictionView
        key={viewKey}
        result={result}
        basePath="/app/prediccion"
        currentScenario={scenario}
        initialSymbol={resolvedSymbol}
        initialMetric={resolvedMetric}
        initialHorizon={resolvedHorizon}
        initialWithObserved={withObserved}
      />
    </>
  );
}

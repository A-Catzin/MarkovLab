"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/guards";
import {
  executeAssetPrediction,
  refreshAssetPrediction,
  type PredictionExecuteResult,
} from "@/lib/modules/adapters/prediction.server";
import type { PredictionMetricKind } from "@/lib/modules/types";

/**
 * Genera y guarda un pronóstico de activo en el backend Julia (`POST /api/internal/assets/{id}/predictions`).
 */
export async function runAssetPredictionAction(input: {
  assetId: number;
  metric: PredictionMetricKind;
  horizonDays: 21 | 63 | 126;
  asOf?: string | null;
}): Promise<PredictionExecuteResult> {
  const user = await requireUser();
  const result = await executeAssetPrediction({
    actorId: user.id,
    assetId: input.assetId,
    metric: input.metric,
    horizonDays: input.horizonDays,
    asOf: input.asOf,
  });
  if (result.ok) {
    revalidatePath("/app/prediccion");
  }
  return result;
}

/**
 * Recarga un pronóstico guardado sin reentrenar para contrastar nuevos cierres observados
 * (`GET /api/internal/predictions/{id}`).
 */
export async function refreshAssetPredictionAction(input: {
  predictionId: string;
}): Promise<PredictionExecuteResult> {
  const user = await requireUser();
  return refreshAssetPrediction({
    actorId: user.id,
    predictionId: input.predictionId,
  });
}

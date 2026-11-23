"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/guards";
import {
  executePortfolioOptimization,
  type OptimizationBoundInput,
  type OptimizationExecuteResult,
} from "@/lib/modules/adapters/optimization.server";
import type { OptimizationObjective } from "@/lib/modules/types";

/**
 * Ejecuta y guarda una optimización de cartera en el backend Julia (`POST /api/internal/portfolios/{id}/optimizations`).
 * Nunca modifica los pesos guardados de la cartera.
 */
export async function runPortfolioOptimizationAction(input: {
  portfolioId: string;
  objective: OptimizationObjective;
  bounds: OptimizationBoundInput[];
  lookbackYears?: number;
  riskFreeRate?: number;
  maxVolatility?: number | null;
}): Promise<OptimizationExecuteResult> {
  const user = await requireUser();
  const result = await executePortfolioOptimization({
    actorId: user.id,
    portfolioId: input.portfolioId,
    objective: input.objective,
    bounds: input.bounds,
    lookbackYears: input.lookbackYears,
    riskFreeRate: input.riskFreeRate,
    maxVolatility: input.maxVolatility,
  });
  if (result.ok) {
    revalidatePath("/app/optimizacion");
  }
  return result;
}
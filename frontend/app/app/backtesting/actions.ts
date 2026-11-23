"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/guards";
import {
  executePortfolioBacktest,
  type BacktestExecuteResult,
} from "@/lib/modules/adapters/backtesting.server";
import type { BacktestRebalanceFrequency, BacktestStrategyId } from "@/lib/modules/types";

/**
 * Ejecuta y guarda un backtest fuera de muestra en el backend Julia
 * (`POST /api/internal/portfolios/{id}/backtests`). Nunca modifica los pesos de la cartera.
 */
export async function runPortfolioBacktestAction(input: {
  portfolioId: string;
  strategy: BacktestStrategyId;
  configFrom: string;
  configTo: string;
  evalFrom: string;
  evalTo: string;
  rebalance?: BacktestRebalanceFrequency;
  transactionCostBps?: number;
  riskFreeRate?: number;
  benchmarkId?: number | null;
}): Promise<BacktestExecuteResult> {
  const user = await requireUser();
  const result = await executePortfolioBacktest({
    actorId: user.id,
    portfolioId: input.portfolioId,
    strategy: input.strategy,
    configFrom: input.configFrom,
    configTo: input.configTo,
    evalFrom: input.evalFrom,
    evalTo: input.evalTo,
    rebalance: input.rebalance,
    transactionCostBps: input.transactionCostBps,
    riskFreeRate: input.riskFreeRate,
    benchmarkId: input.benchmarkId,
  });
  if (result.ok) {
    revalidatePath("/app/backtesting");
  }
  return result;
}

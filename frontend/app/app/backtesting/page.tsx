import type { Metadata } from "next";
import { BacktestManager } from "@/components/app/backtesting/BacktestManager";

export const metadata: Metadata = {
  title: "Backtesting",
  description:
    "Prueba una cartera con precios históricos simulados, mide rendimiento, volatilidad, drawdown y Sharpe, y compárala con un benchmark.",
};

export default function BacktestingPage() {
  return <BacktestManager />;
}

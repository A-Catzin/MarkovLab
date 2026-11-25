import type { Metadata } from "next";
import { Source_Serif_4, Young_Serif } from "next/font/google";
import "./globals.css";
import "./experience.css";

const display = Young_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const text = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-text",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MarkovLab · Análisis, optimización y riesgo de carteras",
  description:
    "Laboratorio académico para analizar activos, optimizar carteras, simular riesgo Monte Carlo, evaluar estrategias con backtesting y exportar reportes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${text.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        {/* Activa las animaciones de entrada solo si se ejecutan scripts; sin esto, todo el contenido queda visible. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

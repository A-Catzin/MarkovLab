import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";

export const metadata: Metadata = {
  title: {
    default: "Aplicación",
    template: "%s · MarkovLab",
  },
  description: "Aplicación de MarkovLab para crear carteras, simular riesgo y comparar estrategias.",
};

/** Layout común de la aplicación: navegación, cuenta y contenido. */
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}

import type { Metadata } from "next";
import { CarterasManager } from "@/components/app/carteras/CarterasManager";

export const metadata: Metadata = {
  title: "Carteras",
  description:
    "Crea y administra carteras con tus propios activos y pesos, guarda varias versiones y analiza su rendimiento y riesgo.",
};

export default function CarterasPage() {
  return <CarterasManager />;
}

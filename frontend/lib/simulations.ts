import { type SimulationSummary } from "./simulation";
import { createId } from "./portfolios";

/**
 * Persistencia provisional de simulaciones guardadas (RF-47). Mientras no
 * exista la API Julia, cada simulación se guarda en `localStorage` con sus
 * parámetros y resultados, lista para leerse desde el módulo de historial.
 */

export const SIMULATION_STORAGE_KEY = "markovlab.simulations.v1";
const MAX_SAVED_SIMULATIONS = 50;

export interface SavedSimulation {
  id: string;
  /** Fecha y hora ISO del guardado. */
  createdAt: string;
  name: string;
  weights: number[];
  horizon: number;
  simulations: number;
  seed: number;
  confidence: number;
  capital: number;
  summary: SimulationSummary;
}

export type SimulationInput = Omit<SavedSimulation, "id" | "createdAt">;

function isSavedSimulation(value: unknown): value is SavedSimulation {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.name === "string" &&
    Array.isArray(item.weights) &&
    item.weights.every((weight) => typeof weight === "number") &&
    typeof item.horizon === "number" &&
    typeof item.simulations === "number" &&
    typeof item.seed === "number" &&
    typeof item.confidence === "number" &&
    typeof item.capital === "number" &&
    typeof item.summary === "object" &&
    item.summary !== null
  );
}

export function readSimulations(): SavedSimulation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SIMULATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedSimulation);
  } catch {
    return [];
  }
}

/** Guarda una simulación al inicio de la lista y devuelve la lista actualizada. */
export function saveSimulation(input: SimulationInput): SavedSimulation[] {
  const record: SavedSimulation = {
    ...input,
    id: createId(),
    createdAt: new Date().toISOString(),
  };
  const list = [record, ...readSimulations()].slice(0, MAX_SAVED_SIMULATIONS);
  try {
    window.localStorage.setItem(SIMULATION_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Sin almacenamiento disponible, la simulación sigue visible en pantalla.
  }
  return list;
}

export function deleteSimulation(id: string): SavedSimulation[] {
  const list = readSimulations().filter((item) => item.id !== id);
  try {
    window.localStorage.setItem(SIMULATION_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignorar: si no se puede escribir, la próxima lectura conserva el dato.
  }
  return list;
}

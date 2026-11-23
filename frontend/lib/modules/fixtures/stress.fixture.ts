import type { AdapterResult, ViewScenario } from "../runtime";
import type { StressShockInput, StressTestingData } from "../types";

const PRESETS: StressShockInput[] = [
  {
    presetId: "caida-mercado",
    label: "Caída general de mercado",
    description: "Choque adverso de retorno (-18 pp), volatilidad al 1.55× y aumento moderado de correlaciones.",
    returnShift: -0.18,
    volatilityMultiplier: 1.55,
    correlationShift: 0.25,
  },
  {
    presetId: "alta-volatilidad",
    label: "Régimen de alta volatilidad",
    description: "Retorno esperado neutralizado (-4 pp) con volatilidad multiplicada por 2.00×.",
    returnShift: -0.04,
    volatilityMultiplier: 2.0,
    correlationShift: 0.15,
  },
  {
    presetId: "correlacion-extrema",
    label: "Correlación extrema en crisis",
    description: "Pérdida de diversificación con desplazamiento de correlaciones (+0.45) y caída de retorno (-12 pp).",
    returnShift: -0.12,
    volatilityMultiplier: 1.4,
    correlationShift: 0.45,
  },
];

export function buildStressTestingFixture(params: {
  portfolioId: string;
  presetId?: string;
  scenario?: ViewScenario;
}): AdapterResult<StressTestingData> {
  const scenario = params.scenario ?? "normal";
  const activePresetId = PRESETS.some((p) => p.presetId === params.presetId)
    ? (params.presetId as string)
    : "caida-mercado";

  if (scenario === "vacio") {
    return {
      status: "empty",
      title: "Sin escenarios de estrés seleccionados",
      message: "Elige una cartera con posiciones válidas y un escenario de choque para comparar contra la simulación base.",
      actionLabel: "Volver a Mis carteras",
      actionHref: "/app/carteras",
    };
  }
  if (scenario === "pocos-datos") {
    return {
      status: "insufficient_data",
      title: "Histórico insuficiente para calibrar el escenario base",
      message: "Uno o más activos de la cartera no tienen suficientes sesiones en común para ejecutar Monte Carlo Base vs Estrés.",
      details: ["Mínimo requerido: 20 sesiones alineadas compartidas por todos los activos."],
      effectiveRange: { from: "2026-10-15", to: "2026-10-30", observations: 12, required: 20 },
    };
  }
  if (scenario === "validacion") {
    return {
      status: "validation_error",
      title: "Parámetros de estrés fuera de rango válido",
      message: "Los choques aplicados deben conservar una matriz de covarianza válida y volatilidades positivas.",
      issues: [
        {
          field: "stress-vol-mult",
          message: "El multiplicador de volatilidad debe ser mayor a 0 y no superar 5.0×.",
        },
      ],
    };
  }
  if (scenario === "no-disponible") {
    return {
      status: "unavailable",
      title: "Simulador de estrés no disponible",
      message: "No pudimos comunicarnos con el motor de simulación en este momento.",
      lastUpdated: "2026-10-30 16:00",
    };
  }
  if (scenario === "denegado") {
    return {
      status: "forbidden",
      title: "Cartera no autorizada",
      message: "Solo el titular de la cartera puede ejecutar pruebas de estrés sobre sus posiciones.",
    };
  }

  const capital = 250000;
  const horizonDays = 252;
  const confidence = 0.95;
  const seed = 42;
  const simulations = 10000;

  const baseline = {
    horizonDays,
    confidence,
    seed,
    simulations,
    expectedFinalValue: 281450,
    medianFinalValue: 278900,
    p5FinalValue: 209250,
    p95FinalValue: 368400,
    varFraction: 0.163,
    varAmount: 40750,
    cvarFraction: 0.208,
    cvarAmount: 52000,
  };

  return {
    status: "ok",
    data: {
      portfolioId: params.portfolioId,
      portfolioName: "Núcleo Académico · v3",
      capital,
      currency: "MXN",
      horizonDays,
      confidence,
      seed,
      presets: PRESETS,
      activePresetId,
      baseline,
      stressedByPreset: {
        "caida-mercado": {
          horizonDays,
          confidence,
          seed,
          simulations,
          expectedFinalValue: 236800,
          medianFinalValue: 232100,
          p5FinalValue: 147500,
          p95FinalValue: 342900,
          varFraction: 0.41,
          varAmount: 102500,
          cvarFraction: 0.464,
          cvarAmount: 116000,
        },
        "alta-volatilidad": {
          horizonDays,
          confidence,
          seed,
          simulations,
          expectedFinalValue: 270100,
          medianFinalValue: 261400,
          p5FinalValue: 152500,
          p95FinalValue: 419200,
          varFraction: 0.39,
          varAmount: 97500,
          cvarFraction: 0.451,
          cvarAmount: 112750,
        },
        "correlacion-extrema": {
          horizonDays,
          confidence,
          seed,
          simulations,
          expectedFinalValue: 251200,
          medianFinalValue: 246800,
          p5FinalValue: 164000,
          p95FinalValue: 356500,
          varFraction: 0.344,
          varAmount: 86000,
          cvarFraction: 0.402,
          cvarAmount: 100500,
        },
      },
    },
    provenance: {
      origin: "fixtures",
      freshness: "example",
      isExample: true,
      calculatedAt: "2026-10-30 16:20",
      assumptions: "Mismo horizonte (252 días), confianza (95 %) y semilla (42) en Base y Estrés",
    },
  };
}

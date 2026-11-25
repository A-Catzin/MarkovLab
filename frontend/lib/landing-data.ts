import type { SampleAsset } from "./simulation";

/**
 * Cifras de ejemplo de la cartera de demostración. Son ilustrativas, no datos de
 * mercado: el rendimiento y la volatilidad anuales son valores redondeados y
 * verosímiles, y la matriz de correlación se eligió definida positiva.
 */
export const SAMPLE_ASSETS: SampleAsset[] = [
  { ticker: "AAPL", name: "Apple", annualReturn: 0.184, annualVolatility: 0.221 },
  { ticker: "MSFT", name: "Microsoft", annualReturn: 0.196, annualVolatility: 0.208 },
  { ticker: "JPM", name: "JPMorgan Chase", annualReturn: 0.132, annualVolatility: 0.194 },
  { ticker: "XOM", name: "Exxon Mobil", annualReturn: 0.114, annualVolatility: 0.246 },
];

export const SAMPLE_CORRELATION = [
  [1.0, 0.65, 0.35, 0.2],
  [0.65, 1.0, 0.38, 0.18],
  [0.35, 0.38, 1.0, 0.45],
  [0.2, 0.18, 0.45, 1.0],
];

export const DEFAULT_REQUEST = {
  weights: [32, 28, 22, 18],
  horizon: 21,
  simulations: 10_000,
  seed: 42,
  confidence: 0.95,
};

/** Monto de ejemplo (MXN) con el que el simulador traduce los porcentajes a dinero. */
export const DEFAULT_CAPITAL = 10_000;

export const HORIZON_OPTIONS = [
  { days: 1, label: "1 día" },
  { days: 5, label: "1 semana" },
  { days: 21, label: "1 mes" },
  { days: 63, label: "3 meses" },
  { days: 252, label: "1 año" },
];

export const NAV_LINKS = [
  { href: "#historia", label: "Historia" },
  { href: "#simulador", label: "Simulador" },
  { href: "#modulos", label: "Módulos" },
  { href: "#preguntas", label: "Preguntas" },
];

export const FACTS = [
  { value: "1900", note: "Bachelier modela la Bolsa de París como un paseo aleatorio." },
  { value: "1913", note: "Márkov cuenta 20,000 letras de Eugenio Oneguin." },
  { value: "1948", note: "Primer Monte Carlo en la ENIAC, idea de Ulam y von Neumann." },
  { value: "10,000", note: "Escenarios por simulación en MarkovLab, con semilla fija." },
];

/**
 * Etapas de una solicitud POST /api/risk/monte-carlo (10,000 escenarios, 21 días,
 * cuatro activos con 252 precios); mediana de 30 ejecuciones medidas en el motor Julia.
 */
export const REQUEST_STAGES = [
  { ms: 0.12, duration: "0.12 ms", clause: "Primero, la API lee el JSON y valida pesos, precios y límites." },
  { ms: 0.03, duration: "0.03 ms", clause: "Después, estima rendimientos y covarianza." },
  { ms: 0.66, duration: "0.66 ms", clause: "Luego simula 10,000 escenarios a 21 días." },
  { ms: 2.31, duration: "2.31 ms", clause: "Al final ordena, resume y responde con VaR y CVaR." },
];

export const IMPLEMENTED_METRICS = [
  "Análisis multiactivo, correlación y drawdown",
  "VaR, CVaR y escenarios de estrés Monte Carlo",
  "Optimización de mínima varianza y máximo Sharpe",
  "Predicción con bandas, backtesting y reportes CSV",
];

export const QUESTIONS = [
  {
    question: "¿Es asesoramiento financiero?",
    answer:
      "No. MarkovLab es un proyecto académico para aprender y comparar métodos cuantitativos. Sus resultados describen un modelo, no recomiendan comprar ni vender nada.",
  },
  {
    question: "¿Ejecuta órdenes reales?",
    answer:
      "Nunca. No se conecta con brókers ni guarda credenciales bancarias. Solo calcula a partir de precios históricos almacenados y de la composición de tus carteras.",
  },
  {
    question: "¿Puedo repetir una simulación?",
    answer:
      "Sí. Cada respuesta incluye la semilla, el modelo y todos los parámetros. Con la misma semilla en el mismo motor se obtienen exactamente los mismos escenarios.",
  },
  {
    question: "¿Qué supone el modelo?",
    answer:
      "En Monte Carlo, rendimientos normales e independientes entre sesiones (acompañando el VaR con CVaR ante colas pesadas); en optimización, predicción y backtesting, series históricas reales sin usar cierres futuros fuera de muestra.",
  },
  {
    question: "¿De dónde salen los precios?",
    answer:
      "De la sincronización con API de datos de mercado y de archivos CSV validados por administración, almacenados en PostgreSQL con conversión diaria de divisas cuando una cartera combina monedas.",
  },
  {
    question: "¿Por qué el simulador da otros números que el motor?",
    answer:
      "El de esta portada usa el mismo modelo en tu navegador, con datos de ejemplo y otro generador aleatorio. La distribución coincide; los escenarios uno a uno, no.",
  },
];

export const REPOSITORY_URL = "https://github.com/A-Catzin/MarkovLab";

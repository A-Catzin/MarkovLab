import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Inicio",
  description: "Página principal de la aplicación de MarkovLab.",
};

/** Módulos de la aplicación según el SRS; todos están disponibles. */
const MODULES = [
  {
    name: "Simulador de riesgo",
    description: "Reparte tu dinero entre cuatro empresas de ejemplo y mira 10,000 futuros posibles.",
    href: "/app/simulador",
    status: "Disponible",
  },
  {
    name: "Mis carteras",
    description: "Crea carteras con tus propios activos y pesos, y guarda varias versiones.",
    href: "/app/carteras",
    status: "Disponible",
  },
  {
    name: "Optimización",
    description: "Encuentra la combinación con menos riesgo o con mejor relación entre ganancia y riesgo.",
    href: "/app/optimizacion",
    status: "Disponible",
  },
  {
    name: "Backtesting",
    description: "Prueba una estrategia con precios del pasado y compárala contra un índice de referencia.",
    href: "/app/backtesting",
    status: "Disponible",
  },
  {
    name: "Historial",
    description: "Vuelve a tus simulaciones, carteras y análisis guardados.",
    href: "/app/historial",
    status: "Disponible",
  },
] as const;

/**
 * Página principal de la aplicación. Se llega desde /login mientras no exista
 * autenticación real; el layout de /app aporta la navegación común.
 */
export default function AppHomePage() {
  return (
    <div className="app-page">
      <header>
        <h1>¿Qué quieres analizar hoy?</h1>
        <p className="app-page__lead">
          Crea una cartera, simula su riesgo, optimízala, pruébala con el backtesting o revisa lo que ya guardaste en el
          historial.
        </p>
      </header>

      <div className="app-page__summary" aria-label="Resumen del laboratorio">
        <div>
          <strong>10,000</strong>
          <span>escenarios por simulación</span>
        </div>
        <div>
          <strong>4</strong>
          <span>empresas de ejemplo</span>
        </div>
        <div>
          <strong>5</strong>
          <span>módulos disponibles</span>
        </div>
      </div>

      <ul className="app__modules" aria-label="Módulos">
        {MODULES.map((module) => {
          const available = module.status === "Disponible";
          return (
            <li key={module.name} className={`app__module ${available ? "app__module--on" : ""}`}>
              <Link className="app__module-link" href={module.href}>
                <span className={`app__status ${available ? "app__status--on" : ""}`}>{module.status}</span>
                <h2>{module.name}</h2>
                <p>{module.description}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

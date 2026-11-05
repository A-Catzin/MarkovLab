import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/guards";

export const metadata: Metadata = {
  title: "Inicio · MarkovLab",
  description: "Página principal de la aplicación de MarkovLab.",
};

/** Módulos de la aplicación según el SRS. Los que tienen `href` ya tienen página. */
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
    status: "En construcción",
  },
  {
    name: "Optimización",
    description: "Encuentra la combinación con menos riesgo o con mejor relación entre ganancia y riesgo.",
    status: "Próximamente",
  },
  {
    name: "Backtesting",
    description: "Prueba una estrategia con precios del pasado y compárala contra un índice de referencia.",
    status: "Próximamente",
  },
] as const;

/**
 * Página principal de la aplicación. La sesión y el marco (logo, navegación y "Salir")
 * los pone el layout de /app.
 */
export default async function AppHomePage() {
  const user = await requireUser();
  const firstName = user.name?.split(" ")[0];

  return (
    <div className="app__main">
        <h1>{firstName ? `Hola, ${firstName}` : "Tu laboratorio"}</h1>
        <p className="app__lead">
          Desde aquí vas a crear carteras, simular su riesgo y revisar tus resultados. Empieza por el simulador mientras
          terminamos los demás módulos.
        </p>

        <ul className="app__modules" aria-label="Módulos">
          {MODULES.map((module) => {
            const available = "href" in module;
            const body = (
              <>
                <span className={`app__status ${module.status === "Disponible" ? "app__status--on" : ""}`}>{module.status}</span>
                <h2>{module.name}</h2>
                <p>{module.description}</p>
              </>
            );
            return (
              <li key={module.name} className={`app__module ${available ? "app__module--on" : ""}`}>
                {"href" in module ? (
                  <Link className="app__module-link" href={module.href}>
                    {body}
                  </Link>
                ) : (
                  <div className="app__module-link" aria-disabled="true">
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
    </div>
  );
}

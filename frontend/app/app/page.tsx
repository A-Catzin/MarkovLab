import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/AuthButtons";
import { Wordmark } from "@/components/brand/Wordmark";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Inicio · MarkovLab",
  description: "Página principal de la aplicación de MarkovLab.",
};

/** Módulos de la aplicación según el SRS; solo el simulador está disponible por ahora. */
const MODULES = [
  {
    name: "Simulador de riesgo",
    description: "Reparte tu dinero entre cuatro empresas de ejemplo y mira 10,000 futuros posibles.",
    href: "/#simulador",
    status: "Disponible",
  },
  {
    name: "Mis carteras",
    description: "Crea carteras con tus propios activos y pesos, y guarda varias versiones.",
    status: "Próximamente",
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
 * Página principal de la aplicación. Exige sesión: sin ella, redirige a /login.
 */
export default async function AppHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const firstName = session.user.name?.split(" ")[0];

  return (
    <div className="app">
      <header className="app__top">
        <Wordmark href="/app" />
        <nav className="app__account" aria-label="Cuenta">
          <span className="app__user">{session.user.email}</span>
          <SignOutButton className="link app__signout" />
        </nav>
      </header>

      <main className="app__main">
        <h1>{firstName ? `Hola, ${firstName}` : "Tu laboratorio"}</h1>
        <p className="app__lead">
          Desde aquí vas a crear carteras, simular su riesgo y revisar tus resultados. Empieza por el simulador mientras
          terminamos los demás módulos.
        </p>

        <ul className="app__modules" aria-label="Módulos">
          {MODULES.map((module) => {
            const available = module.status === "Disponible";
            const body = (
              <>
                <span className={`app__status ${available ? "app__status--on" : ""}`}>{module.status}</span>
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
      </main>
    </div>
  );
}

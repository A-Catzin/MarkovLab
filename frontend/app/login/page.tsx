import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

export const metadata: Metadata = {
  title: "Entrar · MarkovLab",
  description: "Acceso a la aplicación de MarkovLab.",
};

/**
 * Pantalla de acceso provisional: todavía no hay autenticación, así que el botón
 * lleva directo a la aplicación. El inicio de sesión con Google se integrará después.
 */
export default function LoginPage() {
  return (
    <div className="auth">
      <header className="auth__top">
        <Wordmark />
        <Link className="link" href="/">
          Volver al inicio
        </Link>
      </header>

      <main className="auth__main">
        <div className="auth__intro">
          <h1>Entra a tu laboratorio</h1>
          <p>
            Crea carteras, mide su riesgo y guarda tus simulaciones para volver a ellas cuando quieras.
          </p>
        </div>

        <section className="auth__panel" aria-labelledby="auth-title">
          <h2 id="auth-title">Iniciar sesión</h2>
          <p>Por ahora el acceso es libre: entra directamente para explorar la aplicación.</p>
          <Link className="button auth__action" href="/app">
            Entrar a MarkovLab
          </Link>
          <p className="auth__note">
            Pronto podrás iniciar sesión con tu cuenta de Google para guardar tu trabajo.
          </p>
        </section>
      </main>

      <footer className="auth__legal">
        Proyecto académico. MarkovLab no ejecuta operaciones ni constituye asesoramiento financiero.
      </footer>
    </div>
  );
}

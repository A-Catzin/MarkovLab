import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import { GoogleSignInButton } from "@/components/auth/AuthButtons";
import { Wordmark } from "@/components/brand/Wordmark";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Entrar · MarkovLab",
  description: "Acceso a la aplicación de MarkovLab.",
};

/**
 * Mensajes para los códigos de error con los que Auth.js vuelve a esta página
 * (?error=...). "EmailNotVerified" y "ServiceUnavailable" los fija el callback `signIn`
 * de lib/auth.ts; "AccessDenied" queda para cualquier otro rechazo.
 */
const ERROR_MESSAGES: Record<string, string> = {
  EmailNotVerified: "Tu correo de Google no está verificado. Verifícalo en tu cuenta de Google e inténtalo de nuevo.",
  ServiceUnavailable: "No pudimos guardar tu acceso porque nuestro servidor no responde. Inténtalo en unos minutos.",
  AccessDenied: "No pudimos completar tu acceso. Inténtalo de nuevo.",
  OAuthSignin: "No pudimos conectar con Google. Inténtalo de nuevo.",
  OAuthCallback: "Google no confirmó tu acceso. Inténtalo de nuevo.",
};
const DEFAULT_ERROR = "Algo salió mal al iniciar sesión. Inténtalo de nuevo.";

/** Datos del producto que acompañan al titular; son los valores por defecto del simulador. */
const FACTS = [
  { value: "10,000", label: "futuros por simulación" },
  { value: "Semilla", label: "repite cualquier resultado" },
  { value: "95 %", label: "confianza en VaR y CVaR" },
] as const;

/**
 * Pantalla de acceso: inicio de sesión con Google. Si ya hay sesión, va directo a /app.
 * Detrás, un abanico de trayectorias Monte Carlo se dibuja al entrar y sigue "corriendo"
 * con pulsos de luz que lo recorren.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  if (await getSession()) redirect("/app");
  const { error } = await searchParams;
  const code = Array.isArray(error) ? error[0] : error;
  const message = code ? (ERROR_MESSAGES[code] ?? DEFAULT_ERROR) : null;

  return (
    <div className="auth">
      <AuthBackdrop />
      <header className="auth__top">
        <Wordmark />
        <Link className="link" href="/">
          Volver al inicio
        </Link>
      </header>

      <main className="auth__main">
        <div className="auth__intro">
          <h1 className="lines" aria-label="Entra a tu laboratorio">
            <span className="line" aria-hidden="true">
              <span data-line style={{ ["--i" as string]: 0 }}>
                Entra a tu
              </span>
            </span>
            <span className="line" aria-hidden="true">
              <span data-line style={{ ["--i" as string]: 1 }}>
                laboratorio
              </span>
            </span>
          </h1>
          <p data-load style={{ ["--i" as string]: 0 }}>
            Crea carteras, mide su riesgo y guarda tus simulaciones para volver a ellas cuando quieras.
          </p>
          <dl className="auth__facts" data-load style={{ ["--i" as string]: 1 }}>
            {FACTS.map((fact) => (
              <div key={fact.value}>
                <dt>{fact.value}</dt>
                <dd>{fact.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="auth__side">
        <section className="auth__panel" data-load style={{ ["--i" as string]: 2 }} aria-labelledby="auth-title">
          <h2 id="auth-title">Iniciar sesión</h2>
          <p>Usa tu cuenta de Google. No necesitas crear una contraseña.</p>
          {message && (
            <p className="auth__error" role="alert">
              {message}
            </p>
          )}
          <GoogleSignInButton className="button auth__action" />
          <p className="auth__note">
            Solo usamos tu nombre y tu correo para identificar tu cuenta y guardar tu trabajo.
          </p>
        </section>
        </div>
      </main>

      <footer className="auth__legal">
        Proyecto académico. MarkovLab no ejecuta operaciones ni constituye asesoramiento financiero.
      </footer>
    </div>
  );
}

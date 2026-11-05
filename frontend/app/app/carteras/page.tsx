import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mis carteras · MarkovLab",
  description: "Tus carteras guardadas en MarkovLab.",
};

/** Mis carteras: por ahora vacía, hasta que exista la creación de carteras. */
export default function PortfoliosPage() {
  return (
    <>
      <h1>Mis carteras</h1>
      <section className="empty" aria-labelledby="empty-title">
        <h2 id="empty-title">Todavía no tienes carteras</h2>
        <p>
          Pronto vas a poder crear una cartera con activos reales, repartir tu dinero entre ellos y guardarla para
          simular su riesgo cuando quieras.
        </p>
        <p>Mientras tanto, prueba cómo funciona con la cartera de ejemplo del simulador.</p>
        <Link className="button empty__action" href="/app/simulador">
          Ir al simulador
        </Link>
      </section>
    </>
  );
}

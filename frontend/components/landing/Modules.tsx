import { IMPLEMENTED_METRICS } from "@/lib/landing-data";

export function Modules() {
  return (
    <section className="section" id="modulos" aria-labelledby="modulos-title">
      <div className="mosaic">
        <div className="tile tile--head" data-reveal>
          <h2 id="modulos-title">Qué calcula</h2>
          <p>
            El motor está escrito en Julia y separado en capas: dominio puro, casos de uso, importación de datos y una
            API HTTP que consume esta página.
          </p>
        </div>

        <figure className="tile tile--photo tile--eniac" data-reveal style={{ ["--i" as string]: 1 }}>
          <img
            className="photo"
            src="/archive/reprogramming-eniac.jpg"
            width={1920}
            height={1251}
            alt="Dos programadoras recablean la ENIAC con un programa nuevo en 1946"
            loading="lazy"
          />
          <figcaption>Programadoras recablean la ENIAC, 1946. Ahí se ejecutó el primer Monte Carlo.</figcaption>
        </figure>

        <div className="tile tile--ink tile--figure" data-reveal style={{ ["--i" as string]: 2 }}>
          <strong>±1e-6</strong>
          <p>Tolerancia con la que los pesos deben sumar 100 %.</p>
        </div>

        <div className="tile tile--pale tile--csv" data-reveal style={{ ["--i" as string]: 3 }}>
          <p className="tile-sentence">Importa precios desde CSV y descarta duplicados.</p>
        </div>

        <figure className="tile tile--photo tile--bourse" data-reveal>
          <img
            className="photo"
            src="/archive/la-bourse-paris-annee-1900.jpg"
            width={1920}
            height={1215}
            alt="Postal de la Bolsa de París hacia 1900, con tranvías frente a la fachada de columnas"
            loading="lazy"
          />
          <figcaption>La Bolsa de París hacia 1900, el mercado que Bachelier modeló.</figcaption>
        </figure>

        <div className="tile tile--list" data-reveal style={{ ["--i" as string]: 1 }}>
          <h3>Ya implementado</h3>
          <ul>
            {IMPLEMENTED_METRICS.map((metric) => (
              <li key={metric}>{metric}</li>
            ))}
          </ul>
        </div>

        <div className="tile tile--muted tile--next" data-reveal>
          <p className="tile-sentence">Optimización y backtesting llegan en la próxima etapa.</p>
        </div>

        <figure className="tile tile--photo tile--ticker" data-reveal style={{ ["--i" as string]: 1 }}>
          <img
            className="photo"
            src="/archive/automatic-ticker-apparatus-new-york-stock-exchange.jpg"
            width={1920}
            height={1508}
            alt="Sala de control central de los teletipos automáticos de la Bolsa de Nueva York"
            loading="lazy"
          />
          <figcaption>Teletipos de la Bolsa de Nueva York, central de control, década de 1920.</figcaption>
        </figure>
      </div>
    </section>
  );
}

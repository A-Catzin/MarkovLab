import { FACTS } from "@/lib/landing-data";

export function Intro() {
  return (
    <section className="intro grid" id="historia" aria-labelledby="historia-title">
      <h2 className="intro__title" id="historia-title" data-reveal>
        Por qué Márkov
      </h2>
      <p className="intro__note" data-reveal style={{ ["--i" as string]: 1 }}>
        El nombre viene de Andréi Márkov, que mostró que el siguiente paso puede depender del anterior y aun así
        medirse con probabilidades.
      </p>

      <ul className="facts">
        {FACTS.map((fact, i) => (
          <li key={fact.value} data-reveal style={{ ["--i" as string]: i }}>
            <strong>{fact.value}</strong>
            <span>{fact.note}</span>
          </li>
        ))}
      </ul>

      <div className="intro__story" data-reveal>
        <p>
          En 1913 Márkov tomó las primeras 20,000 letras de <em>Eugenio Oneguin</em>, de Pushkin, y contó con qué
          frecuencia una vocal seguía a otra vocal y una consonante a otra consonante. Así nacieron las cadenas que
          llevan su nombre: secuencias donde el futuro es una probabilidad que se puede calcular.
        </p>
        <p>
          MarkovLab aplica esa idea a carteras de inversión. No predice el precio de mañana: describe todos los
          caminos posibles y mide cuánto podría perderse en los peores.
        </p>
      </div>

      <figure className="intro__plates" data-reveal style={{ ["--i" as string]: 1 }}>
        <div className="plates">
          <img
            className="photo"
            src="/archive/andrei-markov.jpg"
            width={1348}
            height={1929}
            alt="Retrato de Andréi Márkov en 1886"
            loading="lazy"
          />
          <img
            className="photo"
            src="/archive/evgeny-onegin-cover-1825.jpg"
            width={1042}
            height={1618}
            alt="Portada de la primera edición de Eugenio Oneguin, San Petersburgo, 1825"
            loading="lazy"
          />
        </div>
        <figcaption className="caption">Andréi Márkov en 1886 y la primera edición de Eugenio Oneguin, 1825.</figcaption>
      </figure>
    </section>
  );
}

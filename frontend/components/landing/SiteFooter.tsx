import { NAV_LINKS, REPOSITORY_URL } from "@/lib/landing-data";

const CREDITS = [
  {
    title: "Andrei Markov",
    href: "https://commons.wikimedia.org/wiki/File:Andrei_Markov.jpg",
    licence: "Dominio público",
  },
  {
    title: "Evgeny Onegin cover 1825",
    href: "https://commons.wikimedia.org/wiki/File:Evgeny_Onegin_cover_1825.png",
    licence: "Dominio público",
  },
  {
    title: "Reprogramming ENIAC, U.S. Army",
    href: "https://commons.wikimedia.org/wiki/File:Reprogramming_ENIAC.png",
    licence: "Dominio público",
  },
  {
    title: "La Bourse, Paris année 1900, Ladislav Luppa",
    href: "https://commons.wikimedia.org/wiki/File:La_Bourse_-_Paris_ann%C3%A9e_1900.jpg",
    licence: "CC BY-SA 3.0",
  },
  {
    title: "Automatic ticker apparatus, NYSE, Library of Congress",
    href: "https://commons.wikimedia.org/wiki/File:Automatic_ticker_apparatus,_New_York_Stock_Exchange._Central_control_station_LCCN2013647237.jpg",
    licence: "Dominio público",
  },
];

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer__cols">
        <div className="footer__col">
          <ul>
            <li className="first">MarkovLab</li>
            <li className="rest">Proyecto académico de finanzas cuantitativas.</li>
            <li className="rest">Julia, Next.js y PostgreSQL.</li>
          </ul>
        </div>
        <nav className="footer__col" aria-label="Secciones del pie">
          <ul>
            <li className="first">Secciones</li>
            {NAV_LINKS.map((item) => (
              <li key={item.href} className="rest">
                <a className="link" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="footer__col">
          <ul>
            <li className="first">Código</li>
            <li className="rest">
              <a className="link" href={REPOSITORY_URL}>
                Repositorio en GitHub
              </a>
            </li>
            <li className="rest">
              <a className="link" href={`${REPOSITORY_URL}/blob/main/documentacion/tecnica/API.md`}>
                Contrato de la API
              </a>
            </li>
          </ul>
        </div>
        <div className="footer__col">
          <ul>
            <li className="first">Imágenes, vía Wikimedia Commons</li>
            {CREDITS.map((credit) => (
              <li key={credit.href} className="rest">
                <a className="link" href={credit.href}>
                  {credit.title}
                </a>
                , {credit.licence}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div aria-hidden="true" />

      <div>
        <svg className="footer__wordmark" viewBox="0 0 1000 170" role="img" aria-label="MarkovLab">
          <text
            x="0"
            y="140"
            textLength="1000"
            lengthAdjust="spacingAndGlyphs"
            fontSize="180"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            MarkovLab
          </text>
        </svg>
        <p className="footer__legal">
          Con fines educativos. MarkovLab no ejecuta operaciones ni constituye asesoramiento financiero.
        </p>
      </div>
    </footer>
  );
}

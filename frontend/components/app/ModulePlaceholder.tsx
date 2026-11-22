import Link from "next/link";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  items: string[];
  note?: string;
};

/**
 * Pantalla común para los módulos que todavía están en diseño. Evita que la
 * navegación lleve a un 404 y deja claro qué incluirá cada módulo.
 */
export function ModulePlaceholder({ title, description, items, note }: ModulePlaceholderProps) {
  return (
    <div className="module-page">
      <h1>{title}</h1>
      <p className="module-page__status">En diseño · Próximamente</p>
      <p className="module-page__lead">{description}</p>

      <section className="module-page__panel" aria-labelledby="module-plan">
        <h2 id="module-plan">Qué incluirá</h2>
        <ul className="module-page__list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {note ? <p className="module-page__note">{note}</p> : null}

      <div className="module-page__actions">
        <Link className="button" href="/app/simulador">
          Ir al simulador
        </Link>
        <Link className="link" href="/app">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

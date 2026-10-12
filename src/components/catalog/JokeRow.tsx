import { Link } from "react-router-dom";
import type { Joke } from "../../lib/neon-data-api/types";
import { useTaxonomy } from "../layout/TaxonomyContext";
import styles from "./Catalog.module.css";
export function Rating({ value }: { value: number | null }) {
  return (
    <span className="rating">
      {value === null
        ? "Без оценки"
        : `Каталожная оценка: ${new Intl.NumberFormat("ru", { maximumFractionDigits: 2 }).format(value)}`}
    </span>
  );
}
export function JokeTags({ joke }: { joke: Joke }) {
  const taxonomy = useTaxonomy();
  const tags =
    taxonomy.status === "success"
      ? taxonomy.value.filter((t) => joke.term_ids.includes(t.id))
      : [];
  return (
    <>
      {tags.map((t) => (
        <Link
          key={t.id}
          to={`/topics/${t.kind}/${encodeURIComponent(t.slug)}`}
          title="Предложено ИИ"
        >
          {t.name}
        </Link>
      ))}
      {taxonomy.status === "success" && !tags.length && (
        <span>Без рубрики</span>
      )}
    </>
  );
}
export default function JokeRow({
  joke,
  returnTo,
}: {
  joke: Joke;
  returnTo: string;
}) {
  const long = joke.body.length > 1000;
  return (
    <article className={styles.row} aria-label={`Анекдот №${joke.id}`}>
      <Link
        className={styles.body}
        to={`/jokes/${joke.id}`}
        state={{ returnTo }}
      >
        {long ? joke.body.slice(0, 700) + "…" : joke.body}
      </Link>
      {long && (
        <Link
          className={styles.readMore}
          to={`/jokes/${joke.id}`}
          state={{ returnTo }}
        >
          Читать полностью →
        </Link>
      )}
      <div className="tags">
        <JokeTags joke={joke} />
        <Rating value={joke.catalog_rating} />
      </div>
    </article>
  );
}

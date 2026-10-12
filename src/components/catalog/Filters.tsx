import { termLabel } from "../../lib/termLabel";
import { useId, useState } from "react";
import { useTaxonomy } from "../layout/TaxonomyContext";
import type { CatalogQuery } from "../../lib/neon-data-api/query";
import { kinds } from "../../lib/neon-data-api/query";
import type { TermKind } from "../../lib/neon-data-api/types";
import styles from "./Catalog.module.css";
export const kindLabels: Record<TermKind, string> = {
  topic: "Темы",
  character: "Персонажи",
  format: "Формат",
};
export default function Filters({
  query,
  change,
}: {
  query: CatalogQuery;
  change: (q: CatalogQuery) => void;
}) {
  const taxonomy = useTaxonomy(),
    [all, setAll] = useState(false),
    prefix = useId();
  function toggle(kind: TermKind, id: number) {
    const selected = query.filters[kind] ?? [];
    change({
      ...query,
      page: 1,
      filters: {
        ...query.filters,
        [kind]: selected.includes(id)
          ? selected.filter((v) => v !== id)
          : [...selected, id],
      },
    });
  }
  return (
    <div className={styles.filters}>
      <p className={styles.contents}>Оглавление</p>
      <button
        className={styles.all}
        onClick={() => change({ page: 1, sort: query.sort, filters: {} })}
      >
        Все анекдоты
      </button>
      {taxonomy.status === "loading" ? (
        <p role="status" className="subtle">
          Загружаем рубрики…
        </p>
      ) : taxonomy.status === "error" ? (
        <div className="error-inline">
          <p>Рубрики пока недоступны. Анекдоты можно читать.</p>
          <button onClick={taxonomy.retry}>Повторить загрузку рубрик</button>
        </div>
      ) : (
        <>
          {kinds.map((kind) => {
            const terms = taxonomy.value.filter((t) => t.kind === kind);
            const visible =
              kind === "topic" && !all ? terms.slice(0, 6) : terms;
            return (
              <details key={kind} open={kind === "topic" ? true : undefined}>
                <summary>
                  {kindLabels[kind]}
                  <span aria-hidden="true">⌄</span>
                </summary>
                <div className={styles.options}>
                  {visible.map((t) => (
                    <label key={t.id} htmlFor={`${prefix}-${t.id}`}>
                      <input
                        id={`${prefix}-${t.id}`}
                        type="checkbox"
                        checked={query.filters[kind]?.includes(t.id) ?? false}
                        onChange={() => toggle(kind, t.id)}
                      />
                      <span>{termLabel(t)}</span>
                    </label>
                  ))}
                  {!terms.length && (
                    <p className="subtle">В этой рубрике пока нет тем.</p>
                  )}
                </div>
                {kind === "topic" && terms.length > 6 && (
                  <button
                    className={styles.textButton}
                    onClick={() => setAll(!all)}
                  >
                    {all ? "Свернуть темы" : "Все темы →"}
                  </button>
                )}
              </details>
            );
          })}
        </>
      )}
      <details>
        <summary>
          Каталожная оценка<span aria-hidden="true">⌄</span>
        </summary>
        <p className="subtle">
          Оценка из каталога, а не голоса читателей. Для записей без оценки
          показываем «Без оценки».
        </p>
        <button onClick={() => change({ ...query, page: 1, sort: "rating" })}>
          Сначала с высокой оценкой
        </button>
      </details>
      <p className={styles.provenance}>
        <span aria-hidden="true">*</span> Темы и персонажи предложены ИИ.
        Разметка предварительная.
      </p>
    </div>
  );
}

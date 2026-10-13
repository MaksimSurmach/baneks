import { termLabel } from "../lib/termLabel";
import { useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/neon-data-api/client";
import { DataApiError } from "../lib/neon-data-api/errors";
import {
  readQuery,
  writeQuery,
  kinds,
  PAGE_SIZE,
  type CatalogQuery,
} from "../lib/neon-data-api/query";
import { useRequest } from "../lib/useRequest";
import { useTaxonomy } from "../components/layout/TaxonomyContext";
import Filters from "../components/catalog/Filters";
import JokeRow from "../components/catalog/JokeRow";
import RecoveryPanel from "../components/feedback/RecoveryPanel";
import Loading from "../components/feedback/Loading";
import styles from "../components/catalog/Catalog.module.css";
export default function CatalogPage() {
  const [params, setParams] = useSearchParams(),
    location = useLocation(),
    navigate = useNavigate(),
    taxonomy = useTaxonomy(),
    drawer = useRef<HTMLDialogElement>(null),
    results = useRef<HTMLDivElement>(null);
  let query: CatalogQuery = { page: 1, sort: "id", filters: {} };
  try {
    query = readQuery(params);
  } catch {
    /* Invalid URL is handled by the request below. */
  }
  const key = params.toString(),
    load = useCallback(
      (signal: AbortSignal) => {
        try {
          return api.listJokes(readQuery(new URLSearchParams(key)), signal);
        } catch {
          return Promise.reject(new DataApiError("bad-request", 400));
        }
      },
      [key],
    );
  const data = useRequest(key, load);
  const selected = kinds.flatMap((k) =>
    (query.filters[k] ?? []).map((id) => ({ kind: k, id })),
  );
  function change(q: CatalogQuery) {
    setParams(writeQuery(q), { preventScrollReset: true, flushSync: true });
  }
  // Filters keep the reading position; a new page starts at the top of the list.
  function goToPage(page: number) {
    const top = results.current
      ? results.current.getBoundingClientRect().top + window.scrollY
      : 0;
    setParams(writeQuery({ ...query, page }), {
      flushSync: true,
      state: { scrollY: Math.min(window.scrollY, top) },
    });
  }
  function reset() {
    setParams(new URLSearchParams(), {
      preventScrollReset: true,
      flushSync: true,
    });
  }
  const totalPages =
    data.status === "success" && data.value.total !== null
      ? Math.ceil(data.value.total / PAGE_SIZE)
      : null;
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label="Фильтры каталога">
        <Filters query={query} change={change} />
      </aside>
      <div className={styles.results} ref={results}>
        <h1>Банк анекдотов категории Б</h1>
        <p className={styles.intro}>Сначала история. Всё остальное — потом.</p>
        <div className={styles.search}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="7" />
            <path d="m15 15 7 7" />
          </svg>
          <label>
            <input
              disabled
              aria-label="Поиск скоро"
              placeholder="Вспомните фразу или опишите сюжет…"
            />
          </label>
          <span>Поиск скоро</span>
        </div>
        <p className={styles.searchNote}>
          Поиск ещё не подключён. Найдите историю по темам и персонажам.
        </p>
        <div className={styles.toolbar}>
          <p aria-live="polite">
            {data.status === "success"
              ? data.value.total === null
                ? `Показано ${data.value.jokes.length} анекдотов`
                : `${new Intl.NumberFormat("ru").format(data.value.total)} опубликованных анекдотов`
              : data.status === "loading"
                ? "Загружаем анекдоты…"
                : "Каталог временно недоступен"}
          </p>
          <div className={styles.tools}>
            <button
              className={styles.mobileFilters}
              onClick={() => drawer.current?.showModal()}
            >
              Фильтры{selected.length > 0 && ` (${selected.length})`}
            </button>
            <button
              className={styles.random}
              onClick={() =>
                navigate("/jokes/random?" + writeQuery({ ...query, page: 1 }), {
                  state: { returnTo: location.pathname + location.search },
                })
              }
            >
              Случайный анекдот →
            </button>
            <label>
              Сортировка
              <select
                aria-label="Сортировка"
                value={query.sort}
                onChange={(e) =>
                  change({
                    ...query,
                    page: 1,
                    sort: e.target.value as CatalogQuery["sort"],
                  })
                }
              >
                <option value="id">По номеру</option>
                <option value="rating">По каталожной оценке</option>
              </select>
            </label>
          </div>
        </div>
        {selected.length > 0 && (
          <div className={styles.active} aria-label="Активные фильтры">
            {selected.map(({ kind, id }) => (
              <button
                key={`${kind}-${id}`}
                onClick={() =>
                  change({
                    ...query,
                    page: 1,
                    filters: {
                      ...query.filters,
                      [kind]: query.filters[kind]?.filter((v) => v !== id),
                    },
                  })
                }
              >
                {taxonomy.status === "success"
                  ? ((taxonomy.value.find((t) => t.id === id)
                      ? termLabel(taxonomy.value.find((t) => t.id === id)!)
                      : undefined) ?? `Рубрика ${id}`)
                  : `Рубрика ${id}`}{" "}
                <span aria-hidden="true">×</span>
                <span className="sr-only"> — убрать фильтр</span>
              </button>
            ))}
            <button onClick={reset}>Сбросить фильтры</button>
          </div>
        )}
        <div aria-busy={data.status === "loading"}>
          {data.status === "loading" ? (
            <Loading />
          ) : data.status === "error" ? (
            <RecoveryPanel
              error={data.error}
              retry={data.retry}
              reset={reset}
            />
          ) : !data.value.jokes.length ? (
            <section className="empty">
              <h2>
                {query.page > 1
                  ? "На этой странице нет анекдотов"
                  : "Здесь пока тихо"}
              </h2>
              <p>
                {query.page > 1
                  ? "Возможно, архив изменился. Вернитесь на первую страницу."
                  : "Для выбранного сочетания рубрик историй пока нет. Попробуйте убрать один из фильтров."}
              </p>
              <div className="actions">
                {query.page > 1 && (
                  <button onClick={() => goToPage(1)}>
                    На первую страницу
                  </button>
                )}
                <button onClick={reset}>Сбросить фильтры</button>
              </div>
            </section>
          ) : (
            <>
              {data.value.jokes.map((j) => (
                <JokeRow
                  key={j.id}
                  joke={j}
                  returnTo={location.pathname + location.search}
                />
              ))}
              <nav className={styles.pagination} aria-label="Страницы каталога">
                <button
                  disabled={query.page === 1}
                  onClick={() => goToPage(query.page - 1)}
                >
                  ← Предыдущая
                </button>
                <div className={styles.pageNumbers}>
                  {(totalPages === null
                    ? [query.page]
                    : Array.from(
                        new Set([
                          1,
                          query.page - 1,
                          query.page,
                          query.page + 1,
                          totalPages,
                        ]),
                      )
                        .filter((n) => n > 0 && n <= totalPages)
                        .sort((a, b) => a - b)
                  ).map((n, i, arr) => (
                    <span key={n}>
                      {i > 0 && n - arr[i - 1] > 1 && (
                        <span aria-hidden="true"> … </span>
                      )}
                      <button
                        aria-current={n === query.page ? "page" : undefined}
                        aria-label={`Страница ${n}`}
                        onClick={() => goToPage(n)}
                      >
                        {n}
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  disabled={!data.value.hasMore}
                  onClick={() => goToPage(query.page + 1)}
                >
                  Следующая →
                </button>
              </nav>
            </>
          )}
        </div>
      </div>
      <dialog
        ref={drawer}
        className={styles.sheet}
        aria-labelledby="filter-title"
        onClick={(e) => {
          if (e.target === drawer.current) drawer.current?.close();
        }}
      >
        <div className={styles.sheetHeader}>
          <h2 id="filter-title">Фильтры каталога</h2>
          <button
            aria-label="Закрыть фильтры"
            onClick={() => drawer.current?.close()}
          >
            ×
          </button>
        </div>
        <Filters query={query} change={change} />
        <div className={styles.sheetFooter}>
          <button className="primary" onClick={() => drawer.current?.close()}>
            Показать анекдоты
          </button>
        </div>
      </dialog>
    </div>
  );
}

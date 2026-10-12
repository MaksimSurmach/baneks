import type { Joke, Term } from "./types";
import { DataApiError, httpError, normalizeError } from "./errors";
import { joke, term, rows, countFromRange } from "./validation";
import {
  applyFilters,
  buildQuery,
  validId,
  type CatalogQuery,
  type Filters,
} from "./query";
export type JokePage = {
  jokes: Joke[];
  total: number | null;
  hasMore: boolean;
};
export const REQUEST_TIMEOUT = 12000;
export function createClient(
  baseUrl: string,
  options: { timeout?: number; fetch?: typeof fetch } = {},
) {
  const fetcher = options.fetch ?? fetch;
  let cachedTerms: Term[] | undefined;
  async function request(
    path: string,
    params: URLSearchParams,
    signal?: AbortSignal,
  ) {
    if (!/^https?:\/\//.test(baseUrl) || baseUrl.includes("@"))
      throw new DataApiError("invalid-data");
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeout ?? REQUEST_TIMEOUT);
    try {
      const response = await fetcher(
        `${baseUrl.replace(/\/$/, "")}/${path}?${params}`,
        {
          method: "GET",
          credentials: "omit",
          headers: { Accept: "application/json", Prefer: "count=exact" },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw httpError(response.status, response.headers.get("Retry-After"));
      }
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new DataApiError("invalid-data");
      }
      return {
        data,
        total: countFromRange(response.headers.get("Content-Range")),
      };
    } catch (e) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      if (timedOut) throw new DataApiError("timeout", 408);
      throw normalizeError(e);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  async function listJokes(
    q: CatalogQuery,
    signal?: AbortSignal,
  ): Promise<JokePage> {
    const result = await request("jokes", buildQuery(q), signal);
    const parsed = rows(result.data, joke),
      size = q.size ?? 20;
    return {
      jokes: parsed.slice(0, size),
      total: result.total,
      hasMore:
        result.total !== null
          ? q.page * size < result.total
          : parsed.length > size || (size === 100 && parsed.length === 100),
    };
  }
  async function getJoke(jokeId: number, signal?: AbortSignal) {
    if (!validId(jokeId)) throw new DataApiError("bad-request", 400);
    const r = await request(
      "jokes",
      new URLSearchParams({
        select: "id,body,language,catalog_rating,term_ids",
        id: `eq.${jokeId}`,
        limit: "1",
      }),
      signal,
    );
    const found = rows(r.data, joke);
    if (!found.length) throw new DataApiError("not-found", 404);
    if (found[0].id !== jokeId) throw new DataApiError("invalid-data");
    return found[0];
  }
  async function listTerms(signal?: AbortSignal) {
    if (cachedTerms) return cachedTerms;
    const result: Term[] = [];
    for (let offset = 0; offset < 10000; offset += 100) {
      const r = await request(
        "terms",
        new URLSearchParams({
          select: "id,kind,name,slug",
          order: "id.asc",
          limit: "100",
          offset: String(offset),
        }),
        signal,
      );
      const page = rows(r.data, term);
      result.push(...page);
      if (page.length < 100 || (r.total !== null && result.length >= r.total)) {
        cachedTerms = result;
        return result;
      }
    }
    throw new DataApiError("invalid-data");
  }
  async function getRandomJoke(
    filters: Filters = {},
    exclusions: number[] = [],
    signal?: AbortSignal,
  ): Promise<Joke> {
    if (exclusions.length > 16 || exclusions.some((v) => !validId(v)))
      throw new DataApiError("bad-request", 400);
    const p = new URLSearchParams({
      select: "id,body,language,catalog_rating,term_ids",
      order: "id.asc",
      limit: "1",
    });
    applyFilters(p, filters);
    if (exclusions.length) p.set("id", `not.in.(${exclusions.join(",")})`);
    let r = await request("jokes", p, signal);
    rows(r.data, joke);
    if (r.total === 0 && exclusions.length) {
      p.delete("id");
      r = await request("jokes", p, signal);
      rows(r.data, joke);
    }
    if (r.total === null) throw new DataApiError("invalid-data");
    if (r.total === 0) throw new DataApiError("not-found", 404);
    p.set("offset", String(Math.floor(Math.random() * r.total)));
    const selected = rows((await request("jokes", p, signal)).data, joke);
    if (!selected.length) throw new DataApiError("not-found", 404);
    return selected[0];
  }
  return { listJokes, getJoke, listTerms, getRandomJoke };
}
export const api = createClient(import.meta.env.VITE_NEON_DATA_API_URL ?? "");

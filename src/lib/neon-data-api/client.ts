import { createAnonymousTokenProvider } from "./anonymous-token";
import type { Joke, Term } from "./types";
import {
  DataApiError,
  REQUEST_TIMEOUT,
  cancelled,
  httpError,
  networkError,
} from "./errors";
import { joke, term, rows, countFromRange } from "./validation";
import {
  applyFilters,
  buildQuery,
  validId,
  MAX_ROWS,
  PAGE_SIZE,
  type CatalogQuery,
  type Filters,
} from "./query";
export type JokePage = {
  jokes: Joke[];
  total: number | null;
  hasMore: boolean;
};
export { REQUEST_TIMEOUT };
// Taxonomy is small (84 terms today); the cap only stops a runaway pagination loop.
const MAX_TERMS = 10000;
// Exclusions travel in the URL as not.in.(...); a short history is enough.
const MAX_EXCLUSIONS = 16;
export function createClient(
  baseUrl: string,
  options: {
    timeout?: number;
    fetch?: typeof fetch;
    getToken?: (signal: AbortSignal, refresh?: boolean) => Promise<string>;
  } = {},
) {
  const fetcher = options.fetch ?? fetch;
  let cachedTerms: Term[] | undefined;
  async function request(
    path: string,
    params: URLSearchParams,
    signal?: AbortSignal,
    count = false,
  ) {
    if (!/^https?:\/\//.test(baseUrl) || baseUrl.includes("@")) {
      console.error(
        "VITE_NEON_DATA_API_URL is missing or is not an http(s) URL",
      );
      throw new DataApiError("config");
    }
    if (signal?.aborted) throw cancelled();
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeout ?? REQUEST_TIMEOUT);
    try {
      let response: Response;
      for (let attempt = 0; ; attempt++) {
        const token = await options.getToken?.(controller.signal, attempt > 0);
        if (controller.signal.aborted) throw cancelled();
        response = await fetcher(
          `${baseUrl.replace(/\/$/, "")}/${path}?${params}`,
          {
            method: "GET",
            credentials: "omit",
            headers: {
              Accept: "application/json",
              ...(count ? { Prefer: "count=exact" } : {}),
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
          },
        );
        // An expired or rotated token gets one fresh token, not a 403 page.
        if (response.status !== 401 || !token || attempt > 0) break;
      }
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
      if (signal?.aborted) throw cancelled();
      if (timedOut) throw new DataApiError("timeout", 408);
      if (e instanceof DataApiError) throw e;
      // Only fetch itself throws anything else here: the network failed.
      throw networkError();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  async function listJokes(
    q: CatalogQuery,
    signal?: AbortSignal,
  ): Promise<JokePage> {
    let result;
    try {
      result = await request("jokes", buildQuery(q), signal, true);
    } catch (e) {
      // PostgREST answers 416 to an offset past the end when counting:
      // a stale ?page= link is an empty page, not a bad request.
      if (e instanceof DataApiError && e.status === 416)
        return { jokes: [], total: null, hasMore: false };
      throw e;
    }
    const parsed = rows(result.data, joke),
      size = q.size ?? PAGE_SIZE;
    return {
      jokes: parsed.slice(0, size),
      total: result.total,
      hasMore:
        result.total !== null
          ? q.page * size < result.total
          : parsed.length > size ||
            (size === MAX_ROWS && parsed.length === MAX_ROWS),
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
    for (let offset = 0; offset < MAX_TERMS; offset += MAX_ROWS) {
      const r = await request(
        "terms",
        new URLSearchParams({
          select: "id,kind,name,slug",
          order: "id.asc",
          limit: String(MAX_ROWS),
          offset: String(offset),
        }),
        signal,
      );
      const page = rows(r.data, term);
      result.push(...page);
      if (page.length < MAX_ROWS) {
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
    if (
      exclusions.length > MAX_EXCLUSIONS ||
      exclusions.some((v) => !validId(v))
    )
      throw new DataApiError("bad-request", 400);
    const p = new URLSearchParams({
      select: "id,body,language,catalog_rating,term_ids",
      order: "id.asc",
      limit: "1",
    });
    applyFilters(p, filters);
    if (exclusions.length) p.set("id", `not.in.(${exclusions.join(",")})`);
    let r = await request("jokes", p, signal, true);
    rows(r.data, joke);
    if (r.total === 0 && exclusions.length) {
      p.delete("id");
      r = await request("jokes", p, signal, true);
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
export const api = createClient(import.meta.env.VITE_NEON_DATA_API_URL ?? "", {
  getToken: createAnonymousTokenProvider(
    import.meta.env.VITE_NEON_AUTH_URL ?? "",
  ),
});

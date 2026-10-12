import { afterEach, describe, expect, test, vi } from "vitest";
import { createClient } from "./client";
import { httpError } from "./errors";
import { buildQuery, readQuery, writeQuery } from "./query";
import { rows, joke, term, countFromRange } from "./validation";
const item = {
  id: 1,
  body: "— Текст.\n— Ответ.",
  language: "ru",
  catalog_rating: null,
  term_ids: [2],
};
const response = (data: unknown, range = "0-0/1") =>
  new Response(JSON.stringify(data), { headers: { "Content-Range": range } });
afterEach(() => vi.useRealTimers());
describe("response validation", () => {
  test("preserves body, null rating and tags", () =>
    expect(joke(item)).toEqual(item));
  test("zero rating is distinct from null", () =>
    expect(joke({ ...item, catalog_rating: 0 }).catalog_rating).toBe(0));
  test.each([
    null,
    {},
    [{ ...item, body: null }],
    [{ ...item, id: 0 }],
    [{ ...item, term_ids: ["no"] }],
    [{ ...item, catalog_rating: "five" }],
  ])("rejects unknown shape %j", (data) =>
    expect(() => rows(data, joke)).toThrow("invalid-data"),
  );
  test("taxonomy validates kind", () => {
    expect(
      term({ id: 2, kind: "topic", name: "Тема", slug: "tema" }).kind,
    ).toBe("topic");
    expect(() =>
      term({ id: 2, kind: "bad", name: "Тема", slug: "tema" }),
    ).toThrow();
  });
  test("count handles empty and unavailable", () => {
    expect(countFromRange("*/0")).toBe(0);
    expect(countFromRange("0-19/40225")).toBe(40225);
    expect(countFromRange("0-19/*")).toBe(null);
    expect(() => countFromRange("oops")).toThrow();
  });
});
describe("query and URL", () => {
  test("page 2, stable null-last sorting, AND kinds and OR selections", () => {
    const q = {
      page: 2,
      sort: "rating" as const,
      filters: { topic: [2, 1], character: [3], format: [4] },
    };
    const p = buildQuery(q);
    expect(p.get("offset")).toBe("20");
    expect(p.get("order")).toBe("catalog_rating.desc.nullslast,id.asc");
    expect(p.get("and")).toBe(
      "(or(term_ids.cs.{1},term_ids.cs.{2}),or(term_ids.cs.{3}),or(term_ids.cs.{4}))",
    );
    expect(readQuery(writeQuery(q))).toEqual({
      ...q,
      filters: { topic: [1, 2], character: [3], format: [4] },
    });
  });
  test.each([
    "page=0",
    "page=-1",
    "page=1.5",
    "sort=unknown",
    "topic=1,NaN",
    "character=0",
    "format=9007199254740992",
  ])("rejects invalid URL %s", (raw) =>
    expect(() => readQuery(new URLSearchParams(raw))).toThrow("bad-request"),
  );
  test("size bounded at API max100", () => {
    expect(
      buildQuery({ page: 1, size: 100, sort: "id", filters: {} }).get("limit"),
    ).toBe("100");
    expect(() =>
      buildQuery({ page: 1, size: 101, sort: "id", filters: {} }),
    ).toThrow();
  });
});
describe("requests", () => {
  test("first, last and empty pages do not require downloading catalogue", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(
          Array.from({ length: 21 }, (_, i) => ({ ...item, id: i + 1 })),
          "0-20/23",
        ),
      )
      .mockResolvedValueOnce(
        response(
          [
            { ...item, id: 21 },
            { ...item, id: 22 },
            { ...item, id: 23 },
          ],
          "20-22/23",
        ),
      )
      .mockResolvedValueOnce(response([], "*/0"));
    const c = createClient("https://example.test", { fetch: f });
    expect(
      await c.listJokes({ page: 1, sort: "id", filters: {} }),
    ).toMatchObject({ total: 23, hasMore: true, jokes: expect.any(Array) });
    expect(
      (await c.listJokes({ page: 2, sort: "id", filters: {} })).jokes,
    ).toHaveLength(3);
    expect(await c.listJokes({ page: 1, sort: "id", filters: {} })).toEqual({
      total: 0,
      hasMore: false,
      jokes: [],
    });
    expect(f.mock.calls[0][1]).toMatchObject({
      method: "GET",
      credentials: "omit",
    });
    expect(f.mock.calls[0][0]).toContain("limit=21");
  });
  test("no count falls back to one lookahead row", async () => {
    const c = createClient("https://example.test", {
      fetch: vi
        .fn()
        .mockResolvedValue(response(Array(21).fill(item), "0-20/*")),
    });
    const r = await c.listJokes({ page: 1, sort: "id", filters: {} });
    expect(r.jokes).toHaveLength(20);
    expect(r.hasMore).toBe(true);
    expect(r.total).toBe(null);
  });
  test.each([400, 401, 403, 404, 408, 429, 500, 502, 503, 504])(
    "maps HTTP %i without reading raw internals",
    async (status) => {
      const c = createClient("https://example.test", {
        fetch: vi
          .fn()
          .mockResolvedValue(new Response("private SQL", { status })),
      });
      await expect(c.getJoke(1)).rejects.toMatchObject({
        kind: httpError(status).kind,
        status,
      });
    },
  );
  test("Retry-After seconds and HTTP dates", () => {
    expect(httpError(429, "2").retryAt).toBeGreaterThan(Date.now());
    expect(httpError(429, "invalid").retryAt).toBeUndefined();
    expect(httpError(429, "Wed, 21 Oct 2026 07:28:00 GMT").retryAt).toBe(
      Date.parse("2026-10-21T07:28:00Z"),
    );
  });
  test("invalid IDs fail without a request", async () => {
    const f = vi.fn();
    const c = createClient("https://example.test", { fetch: f });
    await expect(c.getJoke(-1)).rejects.toMatchObject({ kind: "bad-request" });
    expect(f).not.toHaveBeenCalled();
  });
  test("missing/hidden joke is 404", async () => {
    const c = createClient("https://example.test", {
      fetch: vi.fn().mockResolvedValue(response([], "*/0")),
    });
    await expect(c.getJoke(1)).rejects.toMatchObject({ kind: "not-found" });
  });
  test("invalid JSON is a data failure", async () => {
    const c = createClient("https://example.test", {
      fetch: vi.fn().mockResolvedValue(new Response("{broken")),
    });
    await expect(c.getJoke(1)).rejects.toMatchObject({ kind: "invalid-data" });
  });
  test("network is distinct from offline", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const c = createClient("https://example.test", {
      fetch: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    });
    await expect(c.getJoke(1)).rejects.toMatchObject({ kind: "network" });
    vi.stubGlobal("navigator", { onLine: false });
    await expect(c.getJoke(1)).rejects.toMatchObject({ kind: "offline" });
    vi.unstubAllGlobals();
  });
  test("timeout aborts and has bounded duration", async () => {
    vi.useFakeTimers();
    const c = createClient("https://example.test", {
      timeout: 10,
      fetch: vi.fn<typeof fetch>(
        (_, init) =>
          new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("abort", "AbortError")),
            ),
          ),
      ),
    });
    const pending = expect(c.getJoke(1)).rejects.toMatchObject({
      kind: "timeout",
    });
    await vi.advanceTimersByTimeAsync(11);
    await pending;
  });
  test("caller cancellation stays cancellation", async () => {
    const controller = new AbortController();
    const c = createClient("https://example.test", {
      fetch: vi.fn<typeof fetch>(
        (_, init) =>
          new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("abort", "AbortError")),
            ),
          ),
      ),
    });
    const pending = expect(
      c.getJoke(1, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await pending;
    await expect(c.getJoke(1, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
  test("random uses exact filtered count and offset, excludes previous", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response([item], "0-0/4"))
      .mockResolvedValueOnce(response([{ ...item, id: 4 }], "3-3/4"));
    const c = createClient("https://example.test", { fetch: f });
    expect((await c.getRandomJoke({ topic: [2] }, [1])).id).toBe(4);
    expect(String(f.mock.calls[1][0])).toContain("offset=3");
    expect(decodeURIComponent(String(f.mock.calls[1][0]))).toContain(
      "id=not.in.(1)",
    );
    expect(decodeURIComponent(String(f.mock.calls[1][0]))).toContain(
      "term_ids.cs.{2}",
    );
  });
  test("singleton allows repeat only when exclusion empties dataset", async () => {
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response([], "*/0"))
      .mockResolvedValueOnce(response([item]))
      .mockResolvedValueOnce(response([item]));
    expect(
      (
        await createClient("https://example.test", { fetch: f }).getRandomJoke(
          {},
          [1],
        )
      ).id,
    ).toBe(1);
    expect(f.mock.calls).toHaveLength(3);
  });
  test("random rejects unavailable exact count", async () => {
    const c = createClient("https://example.test", {
      fetch: vi.fn().mockResolvedValue(response([item], "0-0/*")),
    });
    await expect(c.getRandomJoke()).rejects.toMatchObject({
      kind: "invalid-data",
    });
  });
  test("taxonomy paginates cap100 and caches validated results", async () => {
    const terms = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      kind: "topic",
      name: "Тема",
      slug: "t" + i,
    }));
    const f = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(terms, "0-99/101"))
      .mockResolvedValueOnce(
        response([{ ...terms[0], id: 101 }], "100-100/101"),
      );
    const c = createClient("https://example.test", { fetch: f });
    expect(await c.listTerms()).toHaveLength(101);
    expect(await c.listTerms()).toHaveLength(101);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

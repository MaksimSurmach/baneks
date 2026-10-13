import { afterEach, expect, test, vi } from "vitest";
import { createAnonymousTokenProvider } from "./anonymous-token";
import { createClient } from "./client";
const now = () => Math.floor(Date.now() / 1000);
const payload = () => ({
  token: "public.anonymous.token",
  expires_at: now() + 900,
});
const b64 = (v: object) =>
  btoa(JSON.stringify(v))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
const jwt = (claims: object) => `e30.${b64(claims)}.sig`;
const ok = (data: unknown) => async () => new Response(JSON.stringify(data));
const signal = () => new AbortController().signal;
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
test("anonymous token is cached in memory and refreshed before expiry", async () => {
  vi.useFakeTimers();
  const f = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response(JSON.stringify(payload())));
  const token = createAnonymousTokenProvider("https://auth.test/auth", f),
    signal = new AbortController().signal;
  expect(await token(signal)).toBe("public.anonymous.token");
  await token(signal);
  expect(f).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(880000);
  await token(signal);
  expect(f).toHaveBeenCalledTimes(2);
});
test.each([
  {},
  null,
  { token: "bad", expires_at: 4102444800 },
  { token: "a.b.c", expires_at: "4102444800" },
  { token: "a.b.c", expires_at: 0 },
])("rejects invalid anonymous payload %j", async (data) => {
  const token = createAnonymousTokenProvider(
    "https://auth.test/auth",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(data))),
  );
  await expect(token(new AbortController().signal)).rejects.toMatchObject({
    kind: "invalid-data",
  });
});
test("lifetime comes from the token's iat, so a skewed device clock still works", async () => {
  vi.useFakeTimers();
  // Device clock is an hour ahead of the server: expires_at is already in the
  // device's past, yet the token has 900s left.
  const iat = now() - 3600;
  const f = vi
    .fn<typeof fetch>()
    .mockImplementation(ok({ token: jwt({ iat }), expires_at: iat + 900 }));
  const token = createAnonymousTokenProvider("https://auth.test/auth", f);
  expect(await token(signal())).toBe(jwt({ iat }));
  await vi.advanceTimersByTimeAsync(800000);
  await token(signal());
  expect(f).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(80000);
  await token(signal());
  expect(f).toHaveBeenCalledTimes(2);
});
test("an expires_at in milliseconds is not cached for millennia", async () => {
  vi.useFakeTimers();
  const f = vi
    .fn<typeof fetch>()
    .mockImplementation(
      ok({ token: "a.b.c", expires_at: Date.now() + 900000 }),
    );
  const token = createAnonymousTokenProvider("https://auth.test/auth", f);
  await token(signal());
  await vi.advanceTimersByTimeAsync(3600000);
  await token(signal());
  expect(f).toHaveBeenCalledTimes(2);
});
test("refresh bypasses the cache", async () => {
  const f = vi.fn<typeof fetch>().mockImplementation(ok(payload()));
  const token = createAnonymousTokenProvider("https://auth.test/auth", f);
  await token(signal());
  await token(signal(), true);
  expect(f).toHaveBeenCalledTimes(2);
});
test("concurrent callers share one token request", async () => {
  const f = vi.fn<typeof fetch>().mockImplementation(ok(payload()));
  const token = createAnonymousTokenProvider("https://auth.test/auth", f);
  await Promise.all([token(signal()), token(signal())]);
  expect(f).toHaveBeenCalledTimes(1);
});
test("one caller's abort does not cancel the shared request", async () => {
  let respond!: (r: Response) => void;
  const f = vi
    .fn<typeof fetch>()
    .mockReturnValue(new Promise((r) => (respond = r)));
  const token = createAnonymousTokenProvider("https://auth.test/auth", f);
  const first = new AbortController();
  const a = token(first.signal),
    b = token(signal());
  first.abort();
  await expect(a).rejects.toMatchObject({ name: "AbortError" });
  respond(new Response(JSON.stringify(payload())));
  expect(await b).toBe("public.anonymous.token");
  await expect(token(first.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(f).toHaveBeenCalledTimes(1);
});
test("missing auth URL is a configuration error", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const f = vi.fn();
  await expect(
    createAnonymousTokenProvider("", f)(signal()),
  ).rejects.toMatchObject({ kind: "config" });
  expect(f).not.toHaveBeenCalled();
});
test("a 404 from the token endpoint is lost access, not a missing joke", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const token = createAnonymousTokenProvider(
    "https://auth.test/wrong",
    vi.fn().mockResolvedValue(new Response("", { status: 404 })),
  );
  await expect(token(signal())).rejects.toMatchObject({
    kind: "forbidden",
    status: 404,
  });
});
test("token endpoint errors are mapped safely", async () => {
  const token = createAnonymousTokenProvider(
    "https://auth.test/auth",
    vi.fn().mockResolvedValue(new Response("private", { status: 503 })),
  );
  await expect(token(new AbortController().signal)).rejects.toMatchObject({
    kind: "unavailable",
  });
});
test("short-lived token is supplied only to GET API request", async () => {
  const f = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          id: 1,
          body: "Текст",
          language: "ru",
          catalog_rating: null,
          term_ids: [],
        },
      ]),
    ),
  );
  const c = createClient("https://api.test", {
    fetch: f,
    getToken: async () => "public.anonymous.token",
  });
  await c.getJoke(1);
  expect(f.mock.calls[0][1]).toMatchObject({
    method: "GET",
    credentials: "omit",
    headers: { Authorization: "Bearer public.anonymous.token" },
  });
});
test("request deadline also bounds token acquisition", async () => {
  vi.useFakeTimers();
  const c = createClient("https://api.test", {
    timeout: 10,
    getToken: (signal) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () =>
          reject(new DOMException("cancel", "AbortError")),
        ),
      ),
  });
  const pending = expect(c.getJoke(1)).rejects.toMatchObject({
    kind: "timeout",
  });
  await vi.advanceTimersByTimeAsync(11);
  await pending;
});

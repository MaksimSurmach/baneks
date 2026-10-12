import { expect, test, vi } from "vitest";
import { createAnonymousTokenProvider } from "./anonymous-token";
import { createClient } from "./client";
const payload = () => ({
  token: "public.anonymous.token",
  expires_at: Math.floor(Date.now() / 1000) + 900,
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
  vi.useRealTimers();
});
test.each([
  {},
  null,
  { token: "bad", expires_at: 1 },
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
  vi.useRealTimers();
});

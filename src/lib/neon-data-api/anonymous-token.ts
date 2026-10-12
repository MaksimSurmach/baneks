import { DataApiError, httpError } from "./errors";
// Neon issues a public, short-lived anonymous-role JWT without a user account.
// It stays in memory only; the same request signal/timeout covers token acquisition.
export function createAnonymousTokenProvider(
  authUrl: string,
  fetcher: typeof fetch = fetch,
) {
  let cached: { token: string; expires: number } | undefined;
  return async (signal: AbortSignal): Promise<string> => {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (cached && cached.expires > Date.now() + 30000) return cached.token;
    if (!authUrl.startsWith("https://") || authUrl.includes("@"))
      throw new DataApiError("invalid-data");
    const response = await fetcher(
      `${authUrl.replace(/\/$/, "")}/token/anonymous`,
      {
        method: "GET",
        credentials: "omit",
        signal,
        headers: { Accept: "application/json" },
      },
    );
    if (!response.ok)
      throw httpError(response.status, response.headers.get("Retry-After"));
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new DataApiError("invalid-data");
    }
    if (
      !value ||
      typeof value !== "object" ||
      !("token" in value) ||
      !("expires_at" in value)
    )
      throw new DataApiError("invalid-data");
    const v = value as { token: unknown; expires_at: unknown };
    if (
      typeof v.token !== "string" ||
      !/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(v.token) ||
      typeof v.expires_at !== "number" ||
      !Number.isFinite(v.expires_at) ||
      v.expires_at * 1000 <= Date.now()
    )
      throw new DataApiError("invalid-data");
    cached = { token: v.token, expires: v.expires_at * 1000 };
    return cached.token;
  };
}

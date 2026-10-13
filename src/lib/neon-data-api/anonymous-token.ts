import { DataApiError, REQUEST_TIMEOUT, cancelled, httpError } from "./errors";
// Neon issues a public, short-lived anonymous-role JWT without a user account.
// It stays in memory only. Concurrent callers share one fetch; each caller's
// own signal/timeout still bounds its wait.
const MAX_LIFETIME = 3600;
function issuedAt(token: string): number | undefined {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const iat: unknown = JSON.parse(atob(part)).iat;
    return typeof iat === "number" && Number.isFinite(iat) ? iat : undefined;
  } catch {
    return undefined;
  }
}
export function createAnonymousTokenProvider(
  authUrl: string,
  fetcher: typeof fetch = fetch,
) {
  let cached: { token: string; expires: number } | undefined;
  let pending: Promise<string> | undefined;
  async function load(): Promise<string> {
    if (!authUrl.startsWith("https://") || authUrl.includes("@")) {
      console.error("VITE_NEON_AUTH_URL is missing or is not an https URL");
      throw new DataApiError("config");
    }
    let response: Response;
    try {
      response = await fetcher(
        `${authUrl.replace(/\/$/, "")}/token/anonymous`,
        {
          method: "GET",
          credentials: "omit",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
          headers: { Accept: "application/json" },
        },
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError")
        throw new DataApiError("timeout", 408);
      throw e;
    }
    if (!response.ok) {
      const error = httpError(
        response.status,
        response.headers.get("Retry-After"),
      );
      // A 400/404 here means the auth endpoint is wrong or disabled, not that
      // the joke or filters are: report it as lost access.
      if (error.kind !== "bad-request" && error.kind !== "not-found")
        throw error;
      console.error(`Anonymous token endpoint answered ${response.status}`);
      throw new DataApiError("forbidden", response.status);
    }
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
      !Number.isFinite(v.expires_at)
    )
      throw new DataApiError("invalid-data");
    // Lifetime is measured on the server's clock (iat → expires_at), so a skewed
    // device clock neither rejects fresh tokens nor keeps expired ones.
    const lifetime = Math.min(
      v.expires_at - (issuedAt(v.token) ?? Date.now() / 1000),
      MAX_LIFETIME,
    );
    if (!(lifetime > 0)) throw new DataApiError("invalid-data");
    cached = { token: v.token, expires: Date.now() + lifetime * 1000 };
    return v.token;
  }
  return async (signal: AbortSignal, refresh = false): Promise<string> => {
    if (signal.aborted) throw cancelled();
    if (refresh) cached = undefined;
    // Refresh 30s early so a token does not expire mid-request.
    if (cached && cached.expires > Date.now() + 30000) return cached.token;
    const shared = (pending ??= load().finally(() => (pending = undefined)));
    return new Promise((resolve, reject) => {
      const abort = () => reject(cancelled());
      signal.addEventListener("abort", abort, { once: true });
      shared
        .then(resolve, reject)
        .finally(() => signal.removeEventListener("abort", abort));
    });
  };
}

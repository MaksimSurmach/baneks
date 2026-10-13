export type ErrorKind =
  | "bad-request"
  | "forbidden"
  | "not-found"
  | "rate-limit"
  | "server"
  | "unavailable"
  | "timeout"
  | "offline"
  | "network"
  | "invalid-data"
  | "config"
  | "app";
export const REQUEST_TIMEOUT = 12000;
// Used when a 429 carries no readable Retry-After (it must be CORS-exposed).
const DEFAULT_RETRY_AFTER = 5000;
export class DataApiError extends Error {
  constructor(
    readonly kind: ErrorKind,
    readonly status?: number,
    readonly retryAt?: number,
  ) {
    super(kind);
    this.name = "DataApiError";
  }
}
export const statusKinds: Record<number, ErrorKind> = {
  400: "bad-request",
  401: "forbidden",
  403: "forbidden",
  404: "not-found",
  408: "timeout",
  429: "rate-limit",
  500: "server",
  502: "unavailable",
  503: "unavailable",
  504: "unavailable",
};
// Repeating the same request cannot fix these.
export const retryable = (kind: ErrorKind) =>
  kind !== "bad-request" && kind !== "not-found" && kind !== "config";
export function httpError(
  status: number,
  retryAfter: string | null = null,
): DataApiError {
  let retryAt = retryAfter
    ? /^\d+$/.test(retryAfter)
      ? Date.now() + Number(retryAfter) * 1000
      : Date.parse(retryAfter)
    : undefined;
  if (status === 429 && !Number.isFinite(retryAt))
    retryAt = Date.now() + DEFAULT_RETRY_AFTER;
  return new DataApiError(
    statusKinds[status] ?? (status >= 500 ? "server" : "bad-request"),
    status,
    Number.isFinite(retryAt) ? retryAt : undefined,
  );
}
export const cancelled = () => new DOMException("Cancelled", "AbortError");
export const isCancelled = (e: unknown) =>
  e instanceof DOMException && e.name === "AbortError";
export const networkError = () =>
  new DataApiError(
    typeof navigator !== "undefined" && !navigator.onLine
      ? "offline"
      : "network",
  );
// Anything that is not a DataApiError is a bug in our code, not a connection problem.
export function normalizeError(e: unknown): DataApiError {
  if (e instanceof DataApiError) return e;
  console.error(e);
  return new DataApiError("app");
}

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
  | "invalid-data";
export class DataApiError extends Error {
  constructor(
    public kind: ErrorKind,
    public status?: number,
    public retryAt?: number,
  ) {
    super(kind);
    this.name = "DataApiError";
  }
}
export function httpError(
  status: number,
  retryAfter: string | null = null,
): DataApiError {
  const kinds: Record<number, ErrorKind> = {
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
  const retryAt = retryAfter
    ? /^\d+$/.test(retryAfter)
      ? Date.now() + Number(retryAfter) * 1000
      : Date.parse(retryAfter)
    : undefined;
  return new DataApiError(
    kinds[status] ?? (status >= 500 ? "server" : "bad-request"),
    status,
    Number.isFinite(retryAt) ? retryAt : undefined,
  );
}
export const isCancelled = (e: unknown) =>
  e instanceof DOMException && e.name === "AbortError";
export function normalizeError(e: unknown): DataApiError {
  return e instanceof DataApiError
    ? e
    : new DataApiError(
        typeof navigator !== "undefined" && !navigator.onLine
          ? "offline"
          : "network",
      );
}

// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DataApiError } from "./neon-data-api/errors";
import { useRequest } from "./useRequest";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>(
    (res, rej) => ((resolve = res), (reject = rej)),
  );
  return { promise, resolve, reject };
}
test("a stale response that ignores its abort signal cannot replace newer state", async () => {
  const a = deferred<string>(),
    b = deferred<string>();
  // Callers pass stable (useCallback) loaders.
  const loads: Record<string, () => Promise<string>> = {
    a: () => a.promise,
    b: () => b.promise,
  };
  const { result, rerender } = renderHook(({ k }) => useRequest(k, loads[k]), {
    initialProps: { k: "a" },
  });
  rerender({ k: "b" });
  await act(async () => b.resolve("B"));
  await act(async () => a.resolve("A"));
  expect(result.current).toMatchObject({ status: "success", value: "B" });
});
test("retry re-runs the same request and shows loading meanwhile", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new DataApiError("server", 500))
    .mockResolvedValueOnce("ok");
  const { result } = renderHook(() => useRequest("k", load));
  await act(async () => {});
  expect(result.current.status).toBe("error");
  act(() => result.current.retry());
  expect(result.current.status).toBe("loading");
  await act(async () => {});
  expect(result.current).toMatchObject({ status: "success", value: "ok" });
  expect(load).toHaveBeenCalledTimes(2);
});
test("cancellation is not an error, a code bug is an app error", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const buggy = () => Promise.reject(new TypeError("x is undefined"));
  const { result } = renderHook(() => useRequest("k", buggy));
  await act(async () => {});
  expect(result.current.error?.kind).toBe("app");
  const abort = () =>
    Promise.reject(new DOMException("Cancelled", "AbortError"));
  const cancelled = renderHook(() => useRequest("c", abort));
  await act(async () => {});
  expect(cancelled.result.current.status).toBe("loading");
});

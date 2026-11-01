import { useEffect, useState } from "react";
import {
  isCancelled,
  normalizeError,
  type DataApiError,
} from "./neon-data-api/errors";
export type RequestState<T> =
  | { status: "loading"; value?: undefined; error?: undefined }
  | { status: "success"; value: T; error?: undefined }
  | { status: "error"; value?: undefined; error: DataApiError };
export function useRequest<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const [revision, setRevision] = useState(0);
  const requestKey = `${key}:${revision}`;
  const [result, setResult] = useState<{
    key: string;
    state: RequestState<T>;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (value) => {
        if (!controller.signal.aborted)
          setResult({ key: requestKey, state: { status: "success", value } });
      },
      (error) => {
        if (!controller.signal.aborted && !isCancelled(error))
          setResult({
            key: requestKey,
            state: { status: "error", error: normalizeError(error) },
          });
      },
    );
    return () => controller.abort();
  }, [requestKey, load]);
  const state: RequestState<T> =
    result?.key === requestKey ? result.state : { status: "loading" };
  return { ...state, retry: () => setRevision((v) => v + 1) };
}

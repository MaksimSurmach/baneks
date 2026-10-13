import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/neon-data-api/client";
import { readQuery } from "../lib/neon-data-api/query";
import { DataApiError } from "../lib/neon-data-api/errors";
import { useRequest } from "../lib/useRequest";
import Loading from "../components/feedback/Loading";
import RecoveryPanel from "../components/feedback/RecoveryPanel";
export default function RandomPage() {
  const location = useLocation(),
    navigate = useNavigate();
  const search = location.search,
    state = location.state as { returnTo?: string; exclude?: number[] } | null,
    exclude = JSON.stringify(state?.exclude ?? []);
  const load = useCallback(
    (signal: AbortSignal) => {
      try {
        return api.getRandomJoke(
          readQuery(new URLSearchParams(search)).filters,
          JSON.parse(exclude),
          signal,
        );
      } catch {
        return Promise.reject(new DataApiError("bad-request", 400));
      }
    },
    [search, exclude],
  );
  const data = useRequest(search + exclude, load);
  useEffect(() => {
    if (data.status === "success")
      navigate(`/jokes/${data.value.id}`, {
        replace: true,
        state: { returnTo: state?.returnTo ?? "/jokes" + search },
      });
  }, [data.status, data.value, navigate, state?.returnTo, search]);
  return (
    <div className="simple">
      {data.status === "error" ? (
        <RecoveryPanel error={data.error} retry={data.retry} />
      ) : (
        <>
          <h1>Выбираем историю</h1>
          <Loading />
        </>
      )}
    </div>
  );
}

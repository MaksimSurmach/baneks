import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/neon-data-api/client";
import { DataApiError } from "../lib/neon-data-api/errors";
import { useRequest } from "../lib/useRequest";
import { JokeTags, Rating } from "../components/catalog/JokeRow";
import Loading from "../components/feedback/Loading";
import RecoveryPanel from "../components/feedback/RecoveryPanel";
import styles from "../components/reader/Reader.module.css";
export default function JokePage() {
  const { id } = useParams(),
    location = useLocation(),
    navigate = useNavigate(),
    [feedback, setFeedback] = useState("");
  const load = useCallback(
    (signal: AbortSignal) => {
      if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
        return Promise.reject(new DataApiError("bad-request", 400));
      return api.getJoke(Number(id), signal);
    },
    [id],
  );
  const data = useRequest(id ?? "", load);
  const state = location.state as { returnTo?: string } | null;
  const returnTo = state?.returnTo?.startsWith("/jokes")
    ? state.returnTo
    : "/jokes";
  async function copy(text: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("unavailable");
      await navigator.clipboard.writeText(text);
      setFeedback("Скопировано");
    } catch {
      setFeedback(
        "Копирование недоступно. Выделите и скопируйте текст вручную.",
      );
    }
  }
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: "Банк анекдотов категории Б",
          url: window.location.href,
        });
      else await copy(window.location.href);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setFeedback("Не удалось поделиться. Скопируйте ссылку вручную.");
    }
  }
  return (
    <div className={styles.reader}>
      <Link className={styles.back} to={returnTo}>
        ← Вернуться к результатам
      </Link>
      {data.status === "loading" ? (
        <Loading />
      ) : data.status === "error" ? (
        <RecoveryPanel error={data.error} retry={data.retry} />
      ) : (
        <>
          <div className={styles.heading}>
            <h1>Анекдот №{data.value.id}</h1>
            <Rating value={data.value.catalog_rating} />
          </div>
          <article className={styles.text}>{data.value.body}</article>
          <div className="tags">
            <JokeTags joke={data.value} />
          </div>
          <p className={styles.provenance}>
            Темы и персонажи предложены ИИ. Разметка предварительная.
          </p>
          <div className="actions">
            <button onClick={() => copy(data.value.body)}>
              Копировать текст
            </button>
            <button onClick={share}>Поделиться</button>
            <button
              className="primary"
              onClick={() =>
                navigate(
                  "/jokes/random" +
                    (returnTo.includes("?")
                      ? returnTo.slice(returnTo.indexOf("?"))
                      : ""),
                  { state: { returnTo, exclude: [data.value.id] } },
                )
              }
            >
              Ещё случайный →
            </button>
          </div>
          <p className="status" role="status">
            {feedback}
          </p>
        </>
      )}
    </div>
  );
}

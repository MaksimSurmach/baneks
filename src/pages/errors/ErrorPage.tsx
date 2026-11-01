import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { retryable, type DataApiError } from "../../lib/neon-data-api/errors";
import { errorContent } from "./content";
import styles from "./ErrorPage.module.css";
export default function ErrorPage({
  error,
  retry,
  reset,
}: {
  error: DataApiError;
  retry?: () => void;
  reset?: () => void;
}) {
  const navigate = useNavigate(),
    content = errorContent[error.kind],
    [now, setNow] = useState(Date.now);
  const retryAt = error.retryAt;
  useEffect(() => {
    if (!retryAt || retryAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [retryAt]);
  const seconds = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;
  function back() {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate("/jokes");
  }
  return (
    <section className={styles.page} role="alert">
      <p className={styles.code}>{content.code}</p>
      <h1>{content.title}</h1>
      <p className={styles.description}>{content.description}</p>
      <p className={styles.hint}>{content.hint}</p>
      <div className="actions">
        {retryable(error.kind) && (
          <button
            className="primary"
            disabled={seconds > 0}
            onClick={retry ?? (() => navigate("/jokes", { replace: true }))}
          >
            Повторить
          </button>
        )}
        <Link to="/jokes">В каталог</Link>
        <button onClick={back}>Назад</button>
        {(reset || error.kind === "bad-request") && (
          <button
            onClick={reset ?? (() => navigate("/jokes", { replace: true }))}
          >
            Сбросить фильтры
          </button>
        )}
      </div>
      {seconds > 0 && (
        <p className={styles.note} role="status">
          Повторить можно через {seconds} с.
        </p>
      )}
      <p className={styles.note}>Код: BAN-{error.kind.toUpperCase()}</p>
    </section>
  );
}

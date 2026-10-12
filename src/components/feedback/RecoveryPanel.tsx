import { Link, useNavigate } from "react-router-dom";
import type { DataApiError } from "../../lib/neon-data-api/errors";
export default function RecoveryPanel({
  error,
  retry,
  reset,
}: {
  error: DataApiError;
  retry?: () => void;
  reset?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <section className="empty" role="alert">
      <h1>
        {error.kind === "not-found"
          ? "Страница не найдена"
          : "Не удалось загрузить данные"}
      </h1>
      <p>Попробуйте ещё раз или вернитесь в каталог.</p>
      <div className="actions">
        {retry && <button onClick={retry}>Повторить</button>}
        <Link to="/jokes">В каталог</Link>
        <button onClick={() => navigate(-1)}>Назад</button>
        {reset && <button onClick={reset}>Сбросить фильтры</button>}
      </div>
    </section>
  );
}

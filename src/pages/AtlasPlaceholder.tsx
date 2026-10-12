import { Link } from "react-router-dom";
export default function AtlasPlaceholder() {
  return (
    <section className="simple">
      <h1>Атлас в разработке</h1>
      <p>
        Здесь появится карта тем и персонажей. Мы ещё прокладываем маршруты
        между историями.
      </p>
      <p className="subtle">
        Пока можно открыть каталог, выбрать рубрику или довериться случайному
        анекдоту.
      </p>
      <div className="actions">
        <Link to="/jokes">В каталог →</Link>
      </div>
    </section>
  );
}

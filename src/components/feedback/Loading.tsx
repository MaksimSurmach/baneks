export default function Loading() {
  return (
    <div role="status" aria-label="Загрузка анекдотов">
      <p className="subtle">Открываем архив…</p>
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          style={{ padding: "20px 0", borderBottom: "1px solid var(--rule)" }}
          aria-hidden="true"
        >
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ))}
    </div>
  );
}

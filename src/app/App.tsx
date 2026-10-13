import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/neon-data-api/client";
import { useRequest } from "../lib/useRequest";
import { TaxonomyContext } from "../components/layout/TaxonomyContext";
import RenderBoundary from "../components/feedback/RenderBoundary";
import { useScrollRestoration } from "../lib/useScrollRestoration";
import styles from "../components/layout/Layout.module.css";
export default function App() {
  const taxonomy = useRequest("terms", api.listTerms),
    location = useLocation(),
    main = useRef<HTMLElement>(null);
  const [broken, setBroken] = useState(false);
  useScrollRestoration(
    location.pathname + location.search,
    (location.state as { scrollY?: number } | null)?.scrollY,
  );
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      main.current?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);
  return (
    <TaxonomyContext.Provider value={taxonomy}>
      <a className="skip" href="#content">
        К содержимому
      </a>
      <header className={`${styles.hero} ${broken ? styles.broken : ""}`}>
        <picture>
          <img
            className={styles.art}
            src="/assets/hero-wide.webp"
            alt="Иллюстрированная панорама: герои анекдотов за длинным столом на фоне старого города"
            fetchPriority="high"
            onError={() => setBroken(true)}
          />
        </picture>
        <div className={styles.bar}>
          <NavLink className={styles.brand} to="/jokes">
            Банк анекдотов категории Б
          </NavLink>
          <nav aria-label="Главная навигация">
            <NavLink to="/jokes">Каталог</NavLink>
            <NavLink to="/atlas">Атлас</NavLink>
          </nav>
        </div>
      </header>
      <main id="content" ref={main} tabIndex={-1} className={styles.main}>
        <RenderBoundary key={location.pathname}>
          <Outlet />
        </RenderBoundary>
      </main>
      <footer className={styles.footer}>
        Банк анекдотов категории Б{" "}
        <span>Сначала история. Всё остальное — потом.</span>
      </footer>
    </TaxonomyContext.Provider>
  );
}

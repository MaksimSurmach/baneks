import { useLayoutEffect, useRef } from "react";
// Restore after async content grows. No injected inline script, so CSP stays strict.
export function useScrollRestoration(key: string) {
  const previousPath = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const storageKey = "baneks-scroll:" + key,
      path = key.split("?")[0];
    let saved = previousPath.current === path ? window.scrollY : 0;
    previousPath.current = path;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored !== null && Number.isFinite(Number(stored)))
        saved = Math.max(0, Number(stored));
    } catch {
      /* Storage is optional. */
    }
    let active = true,
      currentY = saved;
    const restore = () => {
      if (active) window.scrollTo(0, saved);
    };
    const frame = requestAnimationFrame(restore),
      observer =
        typeof ResizeObserver === "undefined"
          ? undefined
          : new ResizeObserver(restore);
    observer?.observe(document.body);
    const stop = () => {
      active = false;
      currentY = window.scrollY;
      observer?.disconnect();
    };
    const track = () => {
      if (!active) currentY = window.scrollY;
    };
    const interactions = ["wheel", "touchstart", "pointerdown", "keydown"];
    interactions.forEach((name) =>
      window.addEventListener(name, stop, { once: true, passive: true }),
    );
    window.addEventListener("scroll", track, { passive: true });
    const save = () => {
      try {
        sessionStorage.setItem(storageKey, String(currentY));
      } catch {
        /* Reading needs no storage. */
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      save();
      cancelAnimationFrame(frame);
      observer?.disconnect();
      interactions.forEach((name) => window.removeEventListener(name, stop));
      window.removeEventListener("scroll", track);
      window.removeEventListener("pagehide", save);
    };
  }, [key]);
}

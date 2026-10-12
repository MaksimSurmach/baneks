# Task: Implement selected catalog visual direction — Quiet Archive + transparent panorama header

Implement the visual shell of public web catalog for «Банк анекдотов категории Б».

**Use `DESIGN_HANDOFF.md` as contract and `references/catalog-selected-reference.png` as primary visual direction.** The real `assets/hero-original.png` (or `assets/hero-wide.webp`) is the standalone painting, never rasterize the whole mockup as the page.

**Scope:** brand text only; transparent nav strip overlay on painting; two nav links (Каталог/Атлас); responsive hero; compact left chapter-like sidebar; text-first spacious catalog list; search with hybrid/text/semantic selector; quiet metadata, sort/pagination and empty states; mobile filters sheet. Visual quality must match old-book editorial style with readable Cyrillic, large negative space and restrained controls. No fake `joke.title`, ratings, votes or family data.

**Tech:** respect existing repository stack. If new frontend: React+TS and SSR-friendly React Router (Vite) on Cloudflare Workers; CSS Modules/custom properties; PixiJS 8 + pixi-viewport 6 only in separately lazy-loaded Atlas route. Data and search behind server API. Do not overbuild a UI kit or backend in this task.

**Validation:** screenshot compare on desktop 1440 and mobile 390; functional Tab/Enter/Esc search and filter interactions; no overflow at 768; accessible reading contrast; text wrapping including line breaks/long story; CSS and hero imagery remain independently editable; tests capture behavior and edge cases, not just the happy path.

**Deliverables:** working catalog UI + responsive screenshots + brief note on deviations from mock and any decisions requiring approval.

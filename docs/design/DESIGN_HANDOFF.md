# Банк анекдотов категории Б — catalog design handoff

> **Historical.** Search, SSR/Workers and the server API described here were superseded by the static V1; see [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md).

**Status:** SELECTED VISUAL DIRECTION / implementation reference; **not** a pixel-perfect UI specification or approved full design system.
**Date:** 2026-10-11.
**Product:** RANUS — Jokes & Search, public catalog + separate interactive Atlas.
**Approved direction:** "A. Тихий архив" with a new artwork hero and transparent navigation strip.

## 1. Sources of truth

- `references/catalog-selected-reference.png` — **primary**: latest accepted composition of header, painting, search, sidebar, text-first catalog.
- `references/catalog-original-quiet-archive.png` — **secondary**: reference for restrained catalog density, margins, dividers, typography.
- `assets/hero-original.png` — original generated painting **without baked UI**. Use as separately cropped art asset, not as a background of the full screenshot.
- `assets/hero-wide.webp` — compressed browser version of the same original art (optimize/resample separately as needed).

**Important:** generated screenshots are art direction, not exportable HTML or exact source for copy, ratings, category counts, labels, or responsive geometry. Text and interactive elements must be real DOM/UI, not baked into the raster artwork. Human designer/dev should refine spacing after actual browser rendering.

## 2. Visual decisions — preserve

- Name visible in UI: **«Банк анекдотов категории Б»**. Russian UI. Avoid legacy “Joke Atlas” brand label and a standalone logo/jar mark in header.
- Header: thin **transparent navigation bar** OVER the upper edge of the painting; left — brand in text only; right — two links **Каталог · Атлас**. Bar and artwork are separate layout/render layers. Contrast on any crop must be readable; gradient/scrim is allowed only to preserve contrast.
- Below/behind the strip: separate, full-bleed **panorama inspired by the Last Supper** with classic joke archetypes. The image is a broad editorial visual, not a functional panel. Do not overlay text inside the source image. Alt text descriptive, no invented real identities.
- Below the painting: functional light-parchment catalog section, with **left sidebar** and a **wide right reading/results column**.
- In main area: one large title, one search field with a compact selector (Вместе / Текст / По смыслу), result count/sort as quiet metadata, then a **single-column list of jokes** separated with thin rules/whitespace.
- Not a dashboard: no cards with heavy borders, no repeating sets of large CTAs or icon toolbars, no giant counter in hero, no illustration for each joke.
- Sidebar: chapter/index-like section: “Все анекдоты”, “Темы” (open by default), “Персонажи”, “Формат”, “Каталожная оценка” (closed by default). Use checkboxes and progressive disclosure, distinguish type of term; show active filters and reset.
- Per joke: first body lines directly, preserve line breaks; small topics/characters metadata and rating if available; full text on open. Click, keyboard focus and accessible action to open, but visually subtle. Same joke ID used by catalog and map.
- Original joke text has no title column. Do not add invented joke titles.
- Maintain warm antique paper / print tone while text area remains sufficiently uniform, not patterned under letters.
- Atlas artwork/style is a separate mode; do not implement Atlas as a static screenshot of this painting.

## 3. Palette (directional, from initial selected style)

| Role | HEX | Use |
|---|---|---|
| Paper | `#F4E9D4` | Surroundings and subtle warm field |
| Reading surface | `#FFFAF0` | Uniform background behind joke text |
| Ink | `#273631` | Body text / primary headers |
| Forest | `#557A61` | Selected navigation and filters |
| Water | `#699FBB` | Mostly Atlas/cartographic elements |
| Terracotta | `#BD7656` | Sparing accent, subtle links and marks |
| Antique gold | `#B88B49` | Rare decorative print detail, NOT fake rating stars |
| Separator | `#D5C6AD` | Hairlines |

Typography direction: **Literata** or **PT Serif** with Cyrillic for headlines/joke reading, **Golos Text** for UI labels and filter controls. First test Literata + Golos Text in real browser. Avoid font files from unverified sources. Recommended 17–19 px body serif with ~1.5 line-height, 14–16 px UI, comfortable measure <= ~65–75 chars for long passages, not artificially short teaser for every one-liner.

## 4. Layout and responsive behaviors — to refine in browser

- Desktop visual reference is approximately 1440 px wide. Design with responsive fluid main column, rather than hardcoded screenshot positions.
- Transparent header ~64–76 px; illustration hero ~280–380 px at desktop (these are exploratory dimensions, not approved exact pixel values).
- Left sidebar ~230–280 px on desktop; main column uses remaining width with a comfortable text measure and generous padding.
- Search belongs in the catalog content area, NOT baked into painting.
- At tablet/mobile: replace persistent sidebar with accessible filter drawer/bottom sheet; keep visible text search; keep two top-level routes. Reduce hero height/crop responsively. Provide a **mobile-specific art crop** if portrait framing cannot retain meaningful subjects. Avoid horizontal overflow.
- Distinguish top transparent-on-art header from scrolled/fallback backgrounds; preserve readable contrast under all viewport sizes and with image load failure.
- Keyboard: Tab through nav/search/filter/joke controls, Escape closes transient overlays, visible focus. Reduced motion supported; tap targets >= 44x44 on mobile.

## 5. Data integrity contract (facts from source product brief, verified 2026-10-11)

- Published jokes: **40,225** from 40,249. Public UI shows only published.
- Jokes have `body`; **no joke title**.
- Taxonomy: 84 terms (45 topics, 34 characters, 5 formats); all `joke_terms` currently `origin=ai`, `review_status=proposed`. Indicate preliminary tag status, not manual editorial verification.
- Imported ratings: some have 1–5 values; others unscored; use `joke_rating_summary` semantics. Display **«Каталожная оценка»** where available and **«Без оценки»** otherwise. **No user votes** to display yet.
- `story_families` / `joke_relations` empty: no real variant-family/tree UI claims.
- FTS and embeddings enable text and semantic search server-side; hybrid/API weighting not baked into visuals. Never embed vector data, source scrape IDs/URLs, or raw imported source signals in public screens.
- Any sample jokes or scores inside generated mock screenshots are **placeholders only**. Replace with real published records via API at implementation time.

## 6. Implementation split

1. First: visual shell — translucent header, independent artwork, responsive catalog layout, sidebar, search, text-first joke rows, pagination, empty/loading state; can initially use clearly labeled test fixtures.
2. Then: connect real catalog/search API, term filters (multi-select with explicit semantics), score/ranking, random, and canonical joke route.
3. Separately: Atlas scene using existing technical direction PixiJS 8 + pixi-viewport 6. Do not tie Pixi initialization to catalog initial load; lazy-load map route. Catalog link “Показать на карте” preserves same joke ID.

**Suggested stack if starting new web frontend:** React + TypeScript; for Cloudflare-first public site with indexable joke detail pages, React Router full-stack/framework mode (uses Vite) + Cloudflare Workers for SSR; CSS Modules + CSS custom properties for bespoke editorial visual; render illustration as optimized `<picture>` with object-fit, separate from semantic HTML. If existing frontend already uses another stack, retain it unless there is a concrete blocker. For simple non-indexed MVP, React + Vite SPA on Cloudflare is also valid. Avoid adding a large UI framework only for these few controls. Keep Neon behind server API.

## 7. Acceptance criteria for the design-implementation task

- [ ] Screenshot at ~1440x900 clearly resembles `catalog-selected-reference.png` in high-level hierarchy, density, palette, typography and hero image composition; DOM text is live.
- [ ] No header logo; text name exactly «Банк анекдотов категории Б»; only «Каталог» and «Атлас» in global nav.
- [ ] Transparent top bar visibly sits over the panorama; readability maintained.
- [ ] Painting is an independent asset; **no full-page screenshot as background**.
- [ ] Sidebar remains tidy, filters progressive; results are single-column and not boxed in heavy cards.
- [ ] Search mode clearly communicates text vs semantic vs hybrid, with explicit accessible label.
- [ ] Rows show actual joke `body`, preserve line breaks; gracefully handle 1 line and 5,500+ characters.
- [ ] No fake stars, likes, vote totals, invented titles, or preexisting family trees.
- [ ] Search + sidebar + results and mobile filter sheet work at 390px and 768px widths; desktop at 1440px.
- [ ] Semantic navigation, focus, keyboard access, missing image state and legible contrast checked.
- [ ] Source hero imagery and any other standalone visual assets tracked (originally generated for this project); do not import unlicensed Worldspring art/code.

## 8. Out of scope for this handoff

Do not finalize the Atlas design, complete design system, mobile hero illustration remake, full SEO plan, or interaction prototype merely from the screenshot. This packet preserves the **selected direction** and defines the first design-to-implementation handoff.

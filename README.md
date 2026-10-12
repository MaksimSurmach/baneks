# Банк анекдотов категории Б

Frontend-only React / TypeScript / Vite SPA. Published content is read directly from the public Neon Data API; no backend, authentication or database credentials. Search and Atlas are deferred.

## Local development (macOS/Linux)

Node 22+ (CI uses 24). `npm ci`, `cp .env.example .env.local`, then `npm run dev`.

`npm run check` runs lint, TypeScript, unit tests and production build.
`npx playwright install chromium` then `npm run test:e2e` runs browser tests.
`npm run build` produces `dist`; `npm run preview` serves the static production build.

## Cloudflare Pages

1. Workers & Pages → Create → Pages → Connect to Git → GitHub repository `MaksimSurmach/baneks`. Grant repository access.
2. Production branch `master`; root directory `/`; build command `npm run build`; output `dist`; Node version `24`.
3. Set public `VITE_NEON_DATA_API_URL` from `.env.example` for **both Production and Preview**. Never use a PostgreSQL URL or private token in a `VITE_` variable.
4. Enable preview branches for the feature branches; disable automatic production publication until the stack is reviewed and merged. The top QA branch contains the whole release.
5. `_redirects` ships `/* /index.html 200` for deep links. Keep no top-level `404.html`. `_headers` applies browser security rules; adjust `connect-src` if changing API host. No Functions/Worker required.
6. On the actual preview check direct `/jokes/1`, refresh, unknown route, and `/500` with `curl -I`. SPA error screens normally have HTTP **200**, not a dynamic 400/500 status. Local preview is evidence for the application only, not proof of Pages behavior.
7. Rollback: Pages → project → Deployments → previous known-good production deployment → Rollback. Keep API endpoint consistent with that version; changes to Vite variables require a rebuild.

No Cloudflare deployment credentials are configured in this session. GitHub connection, actual preview origin/CORS and Pages status/fallback verification remain release steps; no deployed URL is claimed.

## Data client contract

`src/lib/neon-data-api/client.ts` uses browser GET only with `credentials: omit`, no bearer tokens. Response schemas are validated; errors are safe typed categories. Requests have a 12-second timeout and accept AbortSignal. Jokes use deterministic ID order or `catalog_rating.desc.nullslast,id.asc`. The standard page is 20 rows (21 requested for lookahead if total count is unavailable); all requests stay within the 100-row cap.

Filters are **OR within each kind, AND across kinds**, using nested PostgREST `and=(or(term_ids.cs.{...}),...)`. IDs and URL values are validated before network requests. Taxonomy is cached after validation; no per-row tag queries. Exact count is requested using `Prefer: count=exact`; when not supplied, catalogue has next/previous pagination without an invented total.

Random selection uses exact filtered count + a uniform random integer offset in deterministic ID order, excluding up to 16 IDs. If only one match exists, the exclusion is removed. At most three bounded read requests; cost of large offsets depends on database. Under concurrent publication changes, count/offset is not one database snapshot. If exact count is unavailable, random returns a safe data error rather than pretending a small sample is uniformly random.

### Live API blocker (2026-10-13, Europe/Warsaw)

`node scripts/probe-neon.mjs` performs **real read-only browser fetch** from localhost (no interceptions) through the environment proxy. The result is saved in `docs/qa/neon-browser-probe.json`. All six GET probes returned **HTTP 400, authentication required**. CORS allowed reading those error responses, but no published records were returned. Anonymous data access, exact count, array containment, combined filters and NULLS LAST remain **unverified on production**. The observed Neon configuration declares `anonymous` and `baneks_public`; it was not modified. Do not solve this by putting a private JWT/connection string into the browser. The endpoint owner must restore anonymous reads or supply a working public read-only endpoint, then rerun the probe and the live smoke. Hidden known IDs were not provided and cannot currently be validated.

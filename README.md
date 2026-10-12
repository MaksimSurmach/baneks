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

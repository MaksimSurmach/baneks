# Банк анекдотов категории Б

Frontend V1: React + TypeScript + Vite + React Router, статический GitHub Pages с деплоем через GitHub Actions. Браузер напрямую читает настоящие опубликованные анекдоты из Neon Data API. Панорама и шрифты включены в сборку. Backend, Worker, регистрация, аккаунты и поиск не реализуются; Атлас — оформленная страница «в разработке».

Сайт: https://maksimsurmach.github.io/baneks/

## Запуск

Node 22.12+ (CI: Node 24). На macOS/Linux:

```sh
git clone https://github.com/MaksimSurmach/baneks.git
cd baneks
npm ci
cp .env.example .env.local
npm run dev
```

Открыть адрес из Vite (`http://localhost:5173`). Никаких приватных ключей для запуска не нужно.

```sh
npm run check                 # lint, TypeScript, unit/integration tests, build
npx playwright install chromium
npm run test:e2e              # mock API: interactions, failures, accessibility, screenshots
npm run test:live             # dist from `check`/`build` → real Neon, no mocks
npm run preview               # static production bundle
```

На чистом Linux для браузера может понадобиться `npx playwright install --with-deps chromium`. `npm run test:live` использует уже собранный `dist` (после `npm run check` или `npm run build`); внешний Neon должен быть доступен. E2E с моками работают с фиктивными адресами API, поэтому непойманный запрос не уходит в production. Доступ к браузеру не даёт права менять записи базы.

## Публичный доступ Neon

В `.env.example` заданы два **публичных HTTPS адреса**:

- `VITE_NEON_DATA_API_URL` — существующий REST endpoint `/banksDB/rest/v1`.
- `VITE_NEON_AUTH_URL` — выдача короткоживущего anonymous token `/banksDB/auth`.

Neon требует JWT даже для роли `anonymous`. Браузер делает GET `/token/anonymous` без входа, cookies и создания пользователя, хранит токен только в памяти и использует его для чтения REST. Срок жизни считается по `iat`/`expires_at` самого токена, поэтому сбитые часы устройства не ломают доступ; параллельные запросы получают один токен; ответ 401 один раз обновляет токен и повторяет запрос. Это не приватный API key. Сервис Managed Neon Auth включён с разрешения владельца для этой выдачи; его служебная схема создаётся Neon автоматически. Нет собственной системы авторизации или SQL migrations в приложении.

Data API настроен: **только `baneks_public`**, роль `anonymous`, max100 строк, CORS `*`, aggregates disabled. Роль anonymous имеет только SELECT на `jokes`, `terms`, `joke_terms`. Анекдоты, исходная схема `anek` и публикационные статусы не изменялись.

[Официальный протокол anonymous access](https://neon.com/docs/data-api/access-control#2-the-anonymous-role). Не подставлять connection string, private JWT или пароль в `VITE_*`.

## Данные и URL

Пагинация: 20 анекдотов, максимум 100 строк на запрос. Дополнительная 21-я строка даёт lookahead, если exact count отсутствует. Сортировки: `id.asc` либо `catalog_rating.desc.nullslast,id.asc`. NULL — «Без оценки», не нулевая или придуманная оценка.

Фильтры: **OR внутри типа и AND между типами** через PostgREST `and=(or(term_ids.cs.{…}),…)`. `topic`, `character`, `format` в URL содержат ID через запятую; `page` и `sort=id|rating` сохраняются при обновлении и возврате. Недопустимые значения приводят к 400 с рабочим сбросом. `/topics/:kind/:slug` открывает соответствующую рубрику. Тексты не имеют придуманного заголовка.

`/jokes/random` выбирает случайный опубликованный ID и заменяет адрес на `/jokes/:id`. Следующий выбор сохраняет фильтры и исключает предыдущий ID; при единственном совпадении повтор разрешён. Алгоритм: exact count + равномерный случайный offset, до трёх ограниченных запросов. Большие offset зависят от производительности базы; count/offset не являются одной транзакцией при конкурентном изменении публикаций. Без exact count случайный выбор сообщает об ошибке данных, не имитирует равномерность маленькой выборкой.

Клиент валидирует JSON и поля, принимает AbortSignal, ограничивает запрос вместе с выдачей token 12 секундами. Уход и смена фильтров отменяют запросы; устаревший ответ не заменяет новый. Нет бесконечных автоматических повторов. Рубрики кешируются после валидации, без N+1 запросов. Их отказ не мешает читать уже полученные анекдоты.

## Дизайн и ошибки

Quiet Archive: исходная самостоятельная иллюстрация, Literata/Golos Text с локальной доставкой, бумажная палитра, текстовые строки и тонкие разделители. На 390/768px фильтры — native dialog с Tab/Escape/focus trap. Тексты выводятся через escaped React text, с абзацами; длинные фрагменты открываются полностью в reader. Форматам даны русские подписи, ID/slug не меняются. Предварительная AI-разметка обозначена явно.

Копирование и Web Share работают с честным fallback для недоступных браузерных API. Позиция чтения восстанавливается при возврате к результатам. Поиск явно отключён, ссылка «Атлас» работает как placeholder. [Примечания к референсу](docs/design/IMPLEMENTATION_NOTES.md).

Отдельные маршруты: `/400`, `/401`, `/403`, `/404`, `/408`, `/429`, `/500`, `/502`, `/503`, `/504`, `/timeout`, `/offline`, `/connection`, `/data-error`. Для 400/404 кнопки «Повторить» нет — повтор того же запроса не поможет. Отсутствующий `VITE_*` адрес даёт отдельную страницу «Каталог не настроен», ошибка в коде — «Страница не открылась» (не 500 и не «нет сети»); обе пишутся в console. Устаревшая ссылка `?page=N` за концом каталога (PostgREST 416) показывает пустую страницу. Ошибки API используют те же варианты, не подменяют отказ пустым результатом и не показывают raw SQL, stack trace или credentials. Retry повторяет исходный запрос с фильтрами; `Retry-After` блокирует преждевременный повтор. Header должен быть CORS-exposed (`Access-Control-Expose-Headers: Retry-After`), иначе браузер его не видит и действует пауза 5 с. React Error Boundary показывает безопасную страницу и восстановление; устаревший lazy chunk после deploy перезагружает страницу.

## Проверка живого API

`npm run preview -- --port 4173`, затем `NEON_HIDDEN_TEST_ID=101 node scripts/probe-neon.mjs` проверяет настоящие браузерные GET/CORS, count, array containment, combined filters, NULLS LAST и отсутствие скрытого ID (непустой ответ — провал). Другой origin — `PROBE_ORIGIN`. Использует environment HTTP proxy только там, где он задан. Результат перезаписывает `docs/qa/neon-browser-probe.json`. В проверенной базе: **40 225 опубликованных, 84 рубрики, 9 993 без оценки**. UI не хардкодит эти числа.

`tests/live/neon.spec.ts` проверяет production bundle: каталог → фильтр → page2 → reload → rating → random → next → скрытый ID, плюс 1440/768/390. Второй тест применяет CSP из `public/_headers` к production bundle. Отказы моделируются только через Playwright interception. Скриншоты сохраняются как артефакты CI (`browser-evidence`).

## GitHub Pages и GitHub Actions

Settings → Pages → Source: **GitHub Actions**. Workflow `frontend` проверяет каждый PR; после push в `master` публикует только прошедшую проверки сборку и запускает браузерный smoke на опубликованном URL. Ручной перезапуск — Actions → frontend → Run workflow → `master`.

`npm run build:pages` собирает приложение с base `/baneks/`, добавляет CSP в HTML (Pages не поддерживает Cloudflare `_headers`) и копирует SPA в `404.html`. Router и панорама используют тот же base. Никаких секретов для деплоя не нужно: используются `GITHUB_TOKEN`/OIDC и два публичных Neon URL из workflow. База остаётся в Neon, на GitHub хранятся только статические файлы.

**Ограничение Pages:** прямой переход или refresh `/baneks/jokes/1` загружает приложение через `404.html` и работает, но HTTP-статус документа — **404**. Переходы внутри приложения не перезагружают документ. Это ограничивает SEO/предпросмотр ссылок. CSP из meta не поддерживает `frame-ancestors`; `_headers` и `_redirects` здесь не применяются. Для HTTP 200 на всех SPA-маршрутах и полных security headers можно позже перенести тот же `dist` на Cloudflare Pages или другой хостинг с rewrites.

Проверка локальной Pages-сборки и опубликованного сайта:

```sh
npm run build:pages
LIVE_BASE_PATH=/baneks/ npm run test:live
LIVE_URL=https://maksimsurmach.github.io/baneks/ npm run test:live
```

Live-тесты читают настоящие данные: каталог → фильтр → page2 → refresh → rating → random → next → hidden ID; дополнительно проверяют панораму, шрифты, CSP, прямую ссылку и lazy chunk. Скриншоты и трассы публикуются в artifacts `browser-evidence` и `deployed-browser-evidence`.

Rollback: revert проблемного коммита в `master`; workflow проверит и опубликует предыдущий код. Повтор старого workflow без revert не меняет `master`, следующий push снова опубликует текущую версию.

## Альтернатива: Cloudflare Pages и rollback

1. Workers & Pages → Create → Pages → Connect to Git → `MaksimSurmach/baneks`. Дать GitHub доступ только к этому репозиторию.
2. Production branch `master`; root `/`; build `npm run build`; output `dist`; Node `24`.
3. Задать **оба** публичных `VITE_NEON_DATA_API_URL` и `VITE_NEON_AUTH_URL` из `.env.example` для Production **и** Preview. Изменение Vite env требует rebuild.
4. Preview deployments включить для pull request веток; production публикуется из `master`.
5. `_redirects`: `/* /index.html 200`; нет top-level `404.html`, Functions или Worker. `_headers` содержит CSP, локальные fonts/scripts/styles и разрешение Neon HTTPS. Если API host меняется, обновить `connect-src`.
6. На фактическом preview повторить live smoke и открыть `/jokes/1`, refresh, unknown route, `/500`. Проверить `curl -I`: SPA-страница ошибки обычно имеет HTTP **200**, а не динамический 400/500. Local preview подтверждает bundle/fallback, но не реальное поведение Cloudflare.
7. Rollback: Pages → Deployments → известный рабочий production deploy → Rollback. Согласовать env API с выбранной версией.

Cloudflare не настроен и не используется текущим workflow. Для его подключения нужны доступ к аккаунту, GitHub→Pages connection и проверка preview origin/CORS и HTTP fallback.

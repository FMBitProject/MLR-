---
name: verify
description: Build, launch, and drive MLR Flow locally to verify changes end-to-end.
---

# Verifying MLR Flow

## Setup (throwaway DB — never verify against the Neon URL in app/.env.local)

```bash
docker run -d --name mlr-verify-pg -e POSTGRES_USER=mlr -e POSTGRES_PASSWORD=mlr \
  -e POSTGRES_DB=mlr -p 55432:5432 postgres:16-alpine
cd app
export DATABASE_URL=postgres://mlr:mlr@localhost:55432/mlr
npm run db:migrate && npm run db:seed   # shell DATABASE_URL wins over .env.local (dotenvx does not override)
DATABASE_URL=$DATABASE_URL GROQ_API_KEY= RESEND_API_KEY= APP_URL=http://localhost:3100 \
  npm run dev -- -p 3100   # run in background; first page compile can take ~45s
```

- Without `RESEND_API_KEY`, all outgoing email is printed to the dev log as
  `[dev email] to=... subject=...` followed by the HTML body — grep that to verify email flows.
- Empty `GROQ_API_KEY` keeps the background AI claims check from calling out.

## Seed accounts (password `demo123`, all verified, tenant "Nusantara Pharma")

dewi@ (marketing), budi@ (medical_reviewer), ratna@ (legal_reviewer),
agus@ (regulatory_reviewer), sari@ (compliance_admin), rudi@ (super_admin)
— all `@nusantara-pharma.co.id`.

## Driving the UI (playwright-core in app/node_modules; Chromium already in ~/.cache/ms-playwright)

```js
const { chromium } = require("/workspaces/MLR-/app/node_modules/playwright-core");
```

Gotchas learned the hard way:
- The sidebar logout button is also `button[type="submit"]` — always scope submit
  clicks to the form, e.g. `form:has(input[name="title"]) button[type="submit"]`.
- The resubmit form on the submission page is hidden behind a toggle:
  `button:has(svg.lucide-refresh-cw)`. Fields: `textarea[name="text"]`,
  `textarea[name="changeNote"]` (required).
- Decision buttons: `button[name="decision"][value="approved"|"changes_requested"|"rejected"]`;
  reject/changes stay disabled until `textarea[name="note"]` is filled.
- Switch users by `context.clearCookies()` then logging in again.
- Don't assert on `page.textContent("body")` — it includes the RSC flight payload
  in script tags, which embeds the entire i18n dictionary (every UI string "appears"
  on every page). Assert on visible text via `waitForSelector("text=...")` or
  a specific element instead.
- After adding a new route, run `npx next typegen` or `PageProps<"/new-route">`
  fails typecheck.

## Teardown

Stop the dev task and `docker rm -f mlr-verify-pg`.

# GlobeLedger

GlobeLedger is a bilingual, multi-currency household ledger. It keeps every
transaction in its original currency, saves the exchange-rate snapshot used at
entry time, and presents a consistent budget view in the user's selected base
currency.

## Product scope

- English by default with a persistent Korean language switch
- Every currency currently exposed by Frankfurter, discovered dynamically
- Base-currency dashboard conversion without changing the UI language
- Monthly spending, budget, net-flow, category, and currency-mix summaries
- Weekly, monthly, and yearly recurring expenses and regular income
- Recurring schedule management with monthly forecasts, pause/resume, editing,
  status filters, and full-series deletion
- User-isolated D1 storage with exact minor-unit monetary calculations
- Idempotent transaction creation and owner-scoped deletion
- Responsive desktop, tablet, and mobile layouts
- Site-specific Open Graph and X preview card

## Deployment baseline

The app uses the stable Next.js 16.2 App Router API surface and Cloudflare's
official Vite plugin for direct Workers deployment. Package versions are
pinned, the Next lint rules are aligned to `16.2.12`, and experimental Next.js
APIs are not used. Node.js `22.13.0` or newer is required.

## Local development

```bash
npm ci
npm run dev
```

The local preview is available at `http://localhost:3000`. Cloudflare Workers
binds the application to D1 as `DB`. Create a member through `/auth`; every
transaction and recurring schedule is scoped to that member's server session.

Generate a migration after changing `db/schema.ts`:

```bash
npm run db:generate
```

Run the production build and rendered-output tests:

```bash
npm test
```

## Authentication and member isolation

GlobeLedger uses app-owned email/password authentication designed for the
Cloudflare Workers runtime. Passwords are stored only as PBKDF2-SHA-256 hashes
with a unique random salt. Random session tokens are delivered in HttpOnly,
SameSite cookies, while D1 stores only their SHA-256 hashes. Authentication
attempts are rate-limited by hashed email/IP keys.

Every ledger query takes its owner ID exclusively from the validated server
session. The browser cannot choose or override an owner ID, so transactions,
recurring schedules, exceptions, and per-user state remain member-isolated.

## Direct Cloudflare Workers + D1 deployment

This project is configured for direct Workers deployment through
`wrangler.jsonc`. Deployment remains manual:

1. Run `npm run db:create` once and copy the returned D1 database ID into
   `wrangler.jsonc`.
2. Apply migrations with `npm run db:migrate:remote`.
3. Deploy with `npm run deploy` when ready.

For local D1 migrations, use `npm run db:migrate:local`. Never commit a real
session token or password; no application secret is required for password
hashing because Workers Web Crypto handles PBKDF2 directly.

## Exchange-rate model

Frankfurter v2 is the default reference-rate source. The server discovers every
currency in the provider's latest USD rate response instead of maintaining a
fixed allowlist. It uses a one-hour freshness window, refreshes rates on demand,
and stores the last successful complete result in D1. If an upstream refresh
fails, the last-known-good result remains available with a stale status until a
refresh succeeds.

The application direction is always `1 original currency = rate USD`, even
though Frankfurter returns quote units per USD. The server normalizes that
direction before sending rates to the browser. Transaction inputs are decimal
strings, monetary calculations use integers, and the applied rate, source,
rate date, transaction capture time, and converted USD amount are stored with
each transaction. Frankfurter-labelled snapshots must exactly match the D1
snapshot history. This keeps historical totals stable when later reference
rates change, including when a form was opened before the latest refresh.

## Recurring transactions

A recurring transaction stores its schedule and original-currency template as
a separate series. Opening a month materializes only the occurrences required
for that month, protected by a unique series/date key so repeated requests do
not duplicate entries. Each generated occurrence captures the latest cached
exchange rate available at that time, with the series' original rate snapshot
as an offline fallback.

Editing affects only the selected occurrence. Deleting an occurrence records
an exception so it is not recreated, while stopping a series keeps the selected
and past entries and removes any already-materialized future entries.

The recurring-transactions page provides an owner-scoped view of every active,
paused, and ended schedule. Schedule edits affect future materialized entries;
pausing preserves recorded history, resuming continues generation, and deleting
a schedule removes the series and all of its linked occurrences.

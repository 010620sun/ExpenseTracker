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

The app uses the stable Next.js 16.2 App Router API surface on the
Cloudflare Worker-compatible Sites runtime. Package versions are pinned, the
Next lint rules are aligned to `16.2.12`, and experimental Next.js APIs are not
used. Node.js `22.13.0` or newer is required.

## Local development

```bash
npm ci
npm run dev
```

The local preview is available at `http://localhost:3000`. The hosted service
uses the Sites-provided `DB` binding. Local requests use an isolated
`local-demo` owner; hosted requests use the authenticated workspace user ID.

Generate a migration after changing `db/schema.ts`:

```bash
npm run db:generate
```

Run the production build and rendered-output tests:

```bash
npm test
```

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

# GlobeLedger

GlobeLedger is a bilingual, multi-currency household ledger. It keeps every
transaction in its original currency, saves the exchange-rate snapshot used at
entry time, and presents a consistent budget view in the user's selected base
currency.

## Product scope

- English by default with a persistent Korean language switch
- USD, KRW, EUR, JPY, GBP, SGD, CAD, and AUD entry flows
- Base-currency dashboard conversion without changing the UI language
- Monthly spending, budget, net-flow, category, and currency-mix summaries
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

Frankfurter v2 is the default reference-rate source. The server uses a
one-hour freshness window, refreshes rates on demand, and stores the last
successful result in D1. If an upstream refresh fails, the last-known-good
result remains available with a stale status until a refresh succeeds.

The application direction is always `1 original currency = rate USD`, even
though Frankfurter returns quote units per USD. The server normalizes that
direction before sending rates to the browser. Transaction inputs are decimal
strings, monetary calculations use integers, and the applied rate, source,
rate date, transaction capture time, and converted USD amount are stored with
each transaction. Frankfurter-labelled snapshots must exactly match the D1
snapshot history. This keeps historical totals stable when later reference
rates change, including when a form was opened before the latest refresh.

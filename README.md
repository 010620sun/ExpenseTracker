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

The direction is always `1 original currency = rate USD`. The server accepts
decimal strings, calculates with integers, and stores the rate and converted
USD amount with each transaction. This keeps historical totals stable when
reference rates change. A live rate-provider integration can replace the
current UI reference-rate table without changing stored transaction semantics.

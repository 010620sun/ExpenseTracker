# GlobeLedger

[GlobeLedger](https://globeledger.mizz-globeledger.workers.dev) is a private,
multi-currency household ledger for recording, planning, and reviewing money
without losing the original amount or payment currency.

English is the default interface language. Korean, Japanese, and Russian are
also available and each member's last-used language is remembered.

## What members can do

- Create an independent, password-protected ledger for each member
- Choose an app-wide base currency separately from the last-used transaction
  currency
- Record income and expenses on past, current, or future dates in any currency
  currently supplied by Frankfurter
- Use the monthly calendar to add, edit, and review transactions by date
- Search the full transaction history by text, type, category, and currency
- Use detailed expense and income categories; subcategories are optional
- Split one purchase across consecutive dates or make an exact monthly
  installment plan
- Manage weekly, monthly, and yearly recurring income or expenses
- Set monthly category budgets and reuse the previous month's plan
- Review cash flow and spending by day, category, currency, and merchant
- Follow a three-step first-run guide: choose a base currency, add a
  transaction, and set a budget

## Exchange rates and amounts

GlobeLedger stores the amount and currency entered for every transaction. It
also stores the applied USD reference rate, source, and rate date, so historical
totals do not silently change when a provider later updates its data.

[Frankfurter v2](https://frankfurter.dev/) supplies the reference rates. The
server discovers its currencies dynamically, caches a complete successful
response for one hour, and falls back to the last complete cache if the
provider cannot be reached.

The app normalizes all rates as `1 original currency = USD rate`. No conversion
is performed when a transaction currency is the same as the selected base
currency. Reports can value historical entries using their transaction-date
rate or the current reference rate.

Rates are published by external providers, not continuously. Some currencies,
including Albanian lek (`ALL`), can retain the previous provider date for part
of a day. The interface shows the provider's actual rate date; it does not
invent an intraday rate. See the [Frankfurter ALL reference](https://frankfurter.dev/currencies/all/)
for source coverage.

## Technology

- App Router-compatible React application built with Vinext
- Cloudflare Workers for the web runtime
- Cloudflare D1 with Drizzle ORM for member-owned data
- Workers Web Crypto for PBKDF2 password hashes and session-token hashing
- Frankfurter v2 for reference exchange rates
- TypeScript, ESLint, and Node's built-in test runner

The project targets the stable Next.js 16.2 App Router API surface through
Vinext. Node.js `22.13.0` or newer is required.

## Local development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`, then create a member through `/auth`.

```bash
npm run lint
npm test
```

`npm test` runs the production build and the rendered-output regression suite.

## Authentication and privacy

GlobeLedger uses app-owned email/password authentication. Passwords are stored
only as PBKDF2-SHA-256 hashes with a unique random salt. Browser session tokens
are HttpOnly and SameSite cookies; D1 retains only their SHA-256 hashes.

The server derives the owner ID solely from the validated session. A browser
cannot select an owner ID, so transactions, budgets, recurring schedules,
preferences, and onboarding status are isolated per member.

## Deploying to Cloudflare Workers + D1

The Workers configuration is in [`wrangler.jsonc`](./wrangler.jsonc). The D1
binding is named `DB` and uses migrations in `drizzle/`.

```bash
# First-time setup only
npm run db:create

# Validate a schema migration against local D1
npm run db:generate
npm run db:migrate:local

# Apply the migration to production, then publish the Worker
npm run db:migrate:remote
npm run deploy
```

Read [operations guidance](./docs/operations.md) before applying a production
schema migration. In particular, do not rebuild `user_states`: it is the parent
of member ledger tables and replacing it can trigger cascading deletes.

## Project structure

```text
app/                 Pages, UI, and Worker API routes
app/api/             Authentication, ledger, budget, report, rate, and onboarding APIs
db/schema.ts         Drizzle schema
drizzle/             D1 migrations and Drizzle metadata
lib/                 Currency, category, authentication, and date helpers
tests/                Rendered-output and behavior regression tests
docs/operations.md   Production migration and recovery guidance
```

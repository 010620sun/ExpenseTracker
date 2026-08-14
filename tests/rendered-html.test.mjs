import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("provides login and registration", async () => {
  const [page, screen] = await Promise.all([
    readFile(new URL("../app/auth/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/auth-screen.tsx", import.meta.url), "utf8"),
  ]);
  assert.ok(page.includes("<AuthScreen returnTo={returnTo}"));
  assert.match(screen, /Your money, kept private/u);
  assert.match(screen, /Log in/u);
  assert.match(screen, /Create account/u);
  assert.match(screen, /Member-isolated by design/u);
  assert.match(screen, /나만의 가계부를 안전하게/u);
});

test("protects member ledger pages", async () => {
  const [dashboard, recurring] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/recurring/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /if \(!member\) redirect\("\/auth\?return_to=\/"\)/u);
  assert.match(recurring, /if \(!member\) redirect\("\/auth\?return_to=\/recurring"\)/u);
});

test("pins direct Cloudflare Workers and D1 metadata", async () => {
  const [layout, packageJson, wrangler, vite] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /title: "GlobeLedger/u);
  assert.match(packageJson, /"deploy": "npm run build && wrangler deploy"/u);
  assert.match(wrangler, /"binding": "DB"/u);
  assert.match(wrangler, /"database_name": "globeledger-db"/u);
  assert.match(vite, /configPath: "\.\/wrangler\.jsonc"/u);
  assert.doesNotMatch(vite, /sites\(\)/u);
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
  await assert.rejects(access(new URL("../.openai/hosting.json", templateRoot)));
});

test("provides an expanded visual expense category picker", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const optionsBlock = source.match(
    /const CATEGORY_OPTIONS = \[([\s\S]*?)\] as const;/u,
  );
  assert.ok(optionsBlock);
  const categories = [...optionsBlock[1].matchAll(/"([a-z]+)"/gu)].map(
    (match) => match[1],
  );
  assert.equal(categories.length, 12);
  assert.equal(new Set(categories).size, categories.length);
  assert.match(source, /className="category-popover"/u);
  assert.match(source, /role="listbox"/u);
  assert.match(styles, /\.category-option-grid/u);
});

test("discovers every current Frankfurter currency dynamically", async () => {
  const [ratesRoute, tracker, schema, currencyHelpers] = await Promise.all([
    readFile(new URL("../app/api/rates/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/currency.ts", import.meta.url), "utf8"),
  ]);
  assert.match(ratesRoute, /searchParams\.set\("base", BASE_CURRENCY\)/u);
  assert.doesNotMatch(ratesRoute, /searchParams\.set\("quotes"/u);
  assert.match(ratesRoute, /payload\.length < MIN_REMOTE_CURRENCY_COUNT/u);
  assert.match(tracker, /payload\.currencies\.length < 100/u);
  assert.match(tracker, /function CurrencyPicker/u);
  assert.match(tracker, /currencySearchPlaceholder/u);
  assert.match(tracker, /POPULAR_CURRENCY_CODES/u);
  assert.match(tracker, /type="search"/u);
  assert.match(tracker, /role="listbox"/u);
  assert.match(schema, /exchange_rate_cache_quote_shape/u);
  assert.match(currencyHelpers, /Intl\.DisplayNames/u);
});

test("uses Workers Web Crypto sessions and member-owned ledger APIs", async () => {
  const [schema, auth, login, register, transactionsRoute, recurringRoute] =
    await Promise.all([
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/transactions/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/recurring/route.ts", import.meta.url), "utf8"),
    ]);
  assert.match(schema, /export const members/u);
  assert.match(schema, /export const authSessions/u);
  assert.match(schema, /export const authRateLimits/u);
  assert.match(auth, /PBKDF2/u);
  assert.match(auth, /HttpOnly; SameSite=Lax/u);
  assert.match(auth, /tokenHash: await sha256\(token\)/u);
  assert.match(login, /verifyPasswordOrDummy/u);
  assert.match(register, /hashNewPassword/u);
  assert.match(transactionsRoute, /memberFromRequest/u);
  assert.match(recurringRoute, /memberFromRequest/u);
  assert.doesNotMatch(transactionsRoute, /seedSamplesOnce|Sample transaction/u);
  assert.doesNotMatch(transactionsRoute, /LOCAL_DEMO_OWNER_ID|getChatGPTUser/u);
  assert.doesNotMatch(recurringRoute, /LOCAL_DEMO_OWNER_ID|getChatGPTUser/u);
});

test("supports durable recurring transaction management", async () => {
  const [transactionsRoute, recurringRoute, manager, schema, migration, pauseMigration] =
    await Promise.all([
      readFile(new URL("../app/api/transactions/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/recurring/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/recurring/recurring-manager.tsx", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../drizzle/0003_chilly_unus.sql", import.meta.url), "utf8"),
      readFile(new URL("../drizzle/0004_omniscient_korg.sql", import.meta.url), "utf8"),
    ]);
  assert.match(transactionsRoute, /materializeRecurringTransactions/u);
  assert.match(transactionsRoute, /insert\(recurringExceptions\)/u);
  assert.match(recurringRoute, /action === "pause"/u);
  assert.match(recurringRoute, /action === "resume"/u);
  assert.match(recurringRoute, /action === "update"/u);
  assert.match(recurringRoute, /export async function DELETE/u);
  assert.match(manager, /className="recurring-summary-grid"/u);
  assert.match(schema, /uq_transactions_recurring_occurrence/u);
  assert.match(schema, /pausedAtMs/u);
  assert.match(migration, /"note", NULL, NULL, "client_request_id"/u);
  assert.match(pauseMigration, /"ends_on", NULL, "original_amount_minor"/u);
});

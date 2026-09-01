import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const templateRoot = new URL("../", import.meta.url);

test("provides login and registration", async () => {
  const [page, screen] = await Promise.all([
    readFile(new URL("../app/auth/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/auth/auth-screen.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<AuthScreen initialLanguage=\{initialLanguage\} returnTo=\{returnTo\}/u);
  assert.match(screen, /Your money, kept private/u);
  assert.match(screen, /Log in/u);
  assert.match(screen, /Create account/u);
  assert.match(screen, /Private by design/u);
  assert.match(screen, /나만의 가계부를 안전하게/u);
  assert.match(screen, /自分だけの家計簿を安全に/u);
  assert.match(screen, /Ваши финансы под надёжной защитой/u);
  assert.match(
    screen,
    /const destination = mode === "register" \? "\/guide" : returnTo;/u,
  );
  assert.match(screen, /window\.location\.assign\(destination\)/u);
});

test("protects member ledger pages", async () => {
  const [dashboard, transactions, recurring, budgets, reports, guide] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/transactions/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/recurring/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/budgets/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/reports/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/guide/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /if \(!member\) redirect\("\/auth\?return_to=\/"\)/u);
  assert.match(transactions, /if \(!member\) redirect\("\/auth\?return_to=\/transactions"\)/u);
  assert.match(recurring, /if \(!member\) redirect\("\/auth\?return_to=\/recurring"\)/u);
  assert.match(budgets, /if \(!member\) redirect\("\/auth\?return_to=\/budgets"\)/u);
  assert.match(reports, /if \(!member\) redirect\("\/auth\?return_to=\/reports"\)/u);
  assert.match(guide, /if \(!member\) redirect\("\/auth\?return_to=\/guide"\)/u);
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

test("provides grouped expense and income category pickers", async () => {
  const [source, recurring, budgets, reports, categoriesSource, categoryIcon, styles, schema, transactionsRoute, recurringRoute, migration] = await Promise.all([
    readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/recurring/recurring-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/budgets/budget-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/reports/report-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/categories.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/category-icon.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/transactions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/recurring/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0010_optional_subcategories.sql", import.meta.url), "utf8"),
  ]);
  const expenseBlock = categoriesSource.match(
    /export const EXPENSE_CATEGORY_IDS = \[([\s\S]*?)\] as const;/u,
  );
  const incomeBlock = categoriesSource.match(
    /export const INCOME_CATEGORY_IDS = \[([\s\S]*?)\] as const;/u,
  );
  assert.ok(expenseBlock);
  assert.ok(incomeBlock);
  const expenseCategories = [...expenseBlock[1].matchAll(/"([a-z_]+)"/gu)].map(
    (match) => match[1],
  );
  const incomeCategories = [...incomeBlock[1].matchAll(/"([a-z_]+)"/gu)].map(
    (match) => match[1],
  );
  assert.equal(expenseCategories.length, 21);
  assert.equal(incomeCategories.length, 7);
  assert.equal(new Set(expenseCategories).size, expenseCategories.length);
  assert.equal(new Set(incomeCategories).size, incomeCategories.length);
  assert.match(categoriesSource, /personal_care/u);
  assert.match(categoriesSource, /investment_income/u);
  assert.match(categoriesSource, /Record<LedgerCategoryId, CategoryDefinition>/u);
  assert.match(categoriesSource, /glyph: CategoryGlyphName/u);
  assert.doesNotMatch(categoriesSource, /glyph:\s*"[^"\n]*\p{Extended_Pictographic}/u);
  assert.match(categoryIcon, /Record<CategoryGlyphName, ReactNode>/u);
  assert.match(categoryIcon, /className="category-icon-svg"/u);
  assert.match(categoryIcon, /strokeWidth="1\.7"/u);
  assert.match(source, /className="category-popover"/u);
  assert.match(source, /<CategoryIcon category=\{item\}/u);
  assert.match(source, /categoryGroupsForKind\(kind\)/u);
  assert.match(source, /\n\s+category,\n/u);
  assert.match(recurring, /categoryGroupsForKind/u);
  assert.match(recurring, /<CategoryIcon category=\{key\}/u);
  assert.match(budgets, /EXPENSE_CATEGORY_IDS/u);
  assert.match(budgets, /<CategoryIcon category=\{category\}/u);
  assert.match(reports, /categoryColor/u);
  assert.match(reports, /<CategoryIcon category=\{item\.category\}/u);
  assert.match(source, /role="listbox"/u);
  assert.match(styles, /\.category-option-groups/u);
  assert.match(styles, /\.category-option-grid/u);
  assert.match(styles, /\/\* Unified category iconography \*\//u);
  assert.match(categoriesSource, /export const SUBCATEGORY_META/u);
  assert.match(categoriesSource, /export function subcategoryIdsForCategory/u);
  assert.match(categoriesSource, /export function categoryPathLabel/u);
  assert.match(source, /className="subcategory-options"/u);
  assert.match(recurring, /className="subcategory-options"/u);
  assert.match(transactionsRoute, /isSubcategoryForCategory/u);
  assert.match(recurringRoute, /isSubcategoryForCategory/u);
  assert.equal([...schema.matchAll(/subcategory: text\("subcategory"\)/gu)].length, 2);
  assert.match(migration, /ALTER TABLE `transactions` ADD `subcategory` text/u);
  assert.match(migration, /ALTER TABLE `recurring_series` ADD `subcategory` text/u);
  assert.match(reports, /className="report-subcategory-list"/u);
  assert.match(styles, /\.report-subcategory-list/u);
});

test("allows transactions without an optional subcategory", async () => {
  const [tracker, transactionRoute] = await Promise.all([
    readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/transactions/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(tracker, /subcategory: subcategory \|\| null/u);
  assert.match(
    transactionRoute,
    /normalizeText\(\s*body\.subcategory \?\? undefined,\s*"subcategory",\s*64,\s*\{ fallback: "" \}/u,
  );
  assert.match(transactionRoute, /const subcategory = normalizedSubcategory \|\| null/u);
});

test("keeps every locale complete, grammatical, and durable", async () => {
  const localizedFiles = [
    "app/auth/auth-screen.tsx",
    "components/ledger-navigation.tsx",
    "app/expense-tracker.tsx",
    "app/recurring/recurring-manager.tsx",
    "app/budgets/budget-manager.tsx",
    "app/reports/report-manager.tsx",
    "app/guide/guide-content.tsx",
  ];
  const sources = await Promise.all(
    localizedFiles.map((file) =>
      readFile(new URL(`../${file}`, import.meta.url), "utf8"),
    ),
  );

  for (const [index, source] of sources.entries()) {
    const file = localizedFiles[index];
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let localizedObjectCount = 0;

    function unwrap(expression) {
      if (
        ts.isAsExpression(expression) ||
        ts.isSatisfiesExpression(expression) ||
        ts.isParenthesizedExpression(expression)
      ) {
        return unwrap(expression.expression);
      }
      return expression;
    }

    function propertyName(property) {
      return property.name.getText(sourceFile).replace(/^["']|["']$/gu, "");
    }

    function visit(node) {
      if (
        ts.isVariableDeclaration(node) &&
        node.name.getText(sourceFile).includes("COPY") &&
        node.initializer
      ) {
        const root = unwrap(node.initializer);
        if (ts.isObjectLiteralExpression(root)) {
          const locales = {};
          for (const property of root.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const language = propertyName(property);
            if (!["en", "ko", "ja", "ru"].includes(language)) continue;
            const object = unwrap(property.initializer);
            if (!ts.isObjectLiteralExpression(object)) continue;
            locales[language] = new Map(
              object.properties
                .filter(ts.isPropertyAssignment)
                .map((item) => [
                  propertyName(item),
                  item.initializer.getText(sourceFile),
                ]),
            );
          }
          if (locales.en) {
            localizedObjectCount += 1;
            const englishKeys = [...locales.en.keys()].sort();
            for (const language of ["ko", "ja", "ru"]) {
              assert.deepEqual(
                [...(locales[language]?.keys() ?? [])].sort(),
                englishKeys,
                `${file} ${language} keys must match English`,
              );
              for (const key of englishKeys) {
                const placeholders = (value) =>
                  [...value.matchAll(/\{([a-zA-Z]+)\}/gu)]
                    .map((match) => match[1])
                    .sort();
                assert.deepEqual(
                  placeholders(locales[language].get(key)),
                  placeholders(locales.en.get(key)),
                  `${file} ${language}.${key} placeholders must match English`,
                );
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    assert.ok(localizedObjectCount > 0, `${file} must expose localized copy`);
  }

  const [
    languageSource,
    schema,
    layout,
    tracker,
    auth,
    navigation,
    categories,
    pageMetadata,
  ] =
    await Promise.all([
      readFile(new URL("../lib/language.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/auth/auth-screen.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/ledger-navigation.tsx", import.meta.url), "utf8"),
      readFile(new URL("../lib/categories.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/page-metadata.ts", import.meta.url), "utf8"),
    ]);
  const languageModule = await import(
    `data:text/javascript;base64,${Buffer.from(
      ts.transpileModule(languageSource, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    ).toString("base64")}`
  );

  assert.equal(languageModule.DEFAULT_LANGUAGE, "en");
  assert.equal(languageModule.formatLocalizedCount(1, "en", "transaction"), "1 transaction");
  assert.equal(languageModule.formatLocalizedCount(2, "en", "transaction"), "2 transactions");
  assert.equal(languageModule.formatLocalizedCount(1, "ru", "result"), "1 результат");
  assert.equal(languageModule.formatLocalizedCount(2, "ru", "result"), "2 результата");
  assert.equal(languageModule.formatLocalizedCount(5, "ru", "result"), "5 результатов");
  assert.equal(languageModule.formatLocalizedCount(3, "ko", "result"), "결과 3건");
  assert.equal(languageModule.formatLocalizedCount(2, "ja", "activeDay"), "2日（取引あり）");
  assert.match(schema, /language: text\("language"[\s\S]*?\.default\("en"\)/u);
  assert.match(layout, /const language = await requestLanguage\(\)/u);
  assert.match(layout, /<html lang=\{language\}/u);
  assert.match(layout, /METADATA_COPY/u);
  assert.match(pageMetadata, /overview: "Overview"/u);
  assert.match(pageMetadata, /recurring: "定期取引"/u);
  assert.match(pageMetadata, /reports: "Отчёты"/u);
  assert.doesNotMatch(sources.join("\n"), /document\.title/u);
  assert.match(tracker, /persistLanguagePreference\(language\)/u);
  assert.match(auth, /mode === "register" \|\| languageTouched/u);
  assert.doesNotMatch(auth, /<span className="eyebrow">Multi-currency household ledger<\/span>/u);
  assert.doesNotMatch(navigation, /firstName \?\? "Global citizen"/u);
  assert.match(categories, /export function isCategoryForKind/u);
  assert.match(categories, /CATEGORY_META\.other\.labels\[language\]/u);
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
  const [schema, auth, login, register, transactionsRoute, recurringRoute, ratesRoute, historyRoute] =
    await Promise.all([
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/auth/register/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/transactions/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/recurring/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/rates/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/rates/history/route.ts", import.meta.url), "utf8"),
    ]);
  assert.match(schema, /export const members/u);
  assert.match(schema, /export const authSessions/u);
  assert.match(schema, /export const authRateLimits/u);
  assert.match(auth, /PBKDF2/u);
  assert.match(auth, /HttpOnly; SameSite=Lax/u);
  assert.match(auth, /tokenHash: await sha256\(token\)/u);
  assert.match(auth, /onConflictDoUpdate/u);
  assert.match(auth, /authRateLimits\.attempts\} \+ 1/u);
  assert.match(login, /verifyPasswordOrDummy/u);
  assert.match(register, /hashNewPassword/u);
  assert.match(register, /authRateLimitScopeKey/u);
  assert.match(register, /recordAuthFailure\(registrationRateKey\)/u);
  assert.match(transactionsRoute, /memberFromRequest/u);
  assert.match(recurringRoute, /memberFromRequest/u);
  assert.match(ratesRoute, /memberFromRequest/u);
  assert.match(historyRoute, /memberFromRequest/u);
  assert.doesNotMatch(transactionsRoute, /seedSamplesOnce|Sample transaction/u);
  assert.doesNotMatch(transactionsRoute, /LOCAL_DEMO_OWNER_ID|getChatGPTUser/u);
  assert.doesNotMatch(recurringRoute, /LOCAL_DEMO_OWNER_ID|getChatGPTUser/u);
});

test("keeps currency and language choices as independent member settings", async () => {
  const [tracker, recurring, navigation, languagePicker, preferencesRoute, transactionsRoute, schema, currencyMigration, languageMigration, languageHelpers] =
    await Promise.all([
      readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/recurring/recurring-manager.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/ledger-navigation.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/language-picker.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/preferences/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/transactions/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../drizzle/0006_modern_cyclops.sql", import.meta.url), "utf8"),
      readFile(new URL("../drizzle/0007_mighty_lockjaw.sql", import.meta.url), "utf8"),
      readFile(new URL("../lib/language.ts", import.meta.url), "utf8"),
    ]);

  assert.match(schema, /baseCurrency: text\("base_currency"\)/u);
  assert.match(
    schema,
    /lastTransactionCurrency: text\("last_transaction_currency"\)/u,
  );
  assert.match(preferencesRoute, /memberFromRequest/u);
  assert.match(preferencesRoute, /export async function PATCH/u);
  assert.match(preferencesRoute, /isLanguage\(body\.language\)/u);
  assert.match(tracker, /fetch\("\/api\/preferences"/u);
  assert.match(tracker, /setCurrency\(lastTransactionCurrency\)/u);
  assert.match(tracker, /onChange=\{chooseBaseCurrency\}/u);
  assert.match(tracker, /<LanguagePicker/u);
  assert.match(navigation, /href: "\/recurring"/u);
  assert.match(recurring, /<LanguagePicker/u);
  assert.match(languagePicker, /code: "ja"[\s\S]*?name: "日本語"/u);
  assert.match(languagePicker, /code: "ru"[\s\S]*?name: "Русский"/u);
  assert.match(languagePicker, /aria-haspopup="listbox"/u);
  assert.match(languagePicker, /aria-selected=\{option\.code === value\}/u);
  assert.doesNotMatch(tracker, /globeledger-base-currency/u);
  assert.match(transactionsRoute, /rememberLastTransactionCurrency/u);
  assert.match(
    transactionsRoute,
    /\.set\(\{ lastTransactionCurrency: currency \}\)/u,
  );
  assert.match(currencyMigration, /ALTER TABLE `user_states` ADD `base_currency`/u);
  assert.match(
    currencyMigration,
    /ALTER TABLE `user_states` ADD `last_transaction_currency`/u,
  );
  assert.match(schema, /language: text\("language"/u);
  assert.match(languageMigration, /ALTER TABLE `user_states` ADD `language`/u);
  assert.match(languageHelpers, /\["en", "ko", "ja", "ru"\]/u);
  assert.match(languageHelpers, /ja: "ja-JP"/u);
  assert.match(languageHelpers, /ru: "ru-RU"/u);
});

test("supports durable recurring transaction management", async () => {
  const [transactionsRoute, recurringRoute, manager, navigation, schema, migration, pauseMigration] =
    await Promise.all([
      readFile(new URL("../app/api/transactions/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/recurring/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/recurring/recurring-manager.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/ledger-navigation.tsx", import.meta.url), "utf8"),
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
  assert.match(manager, /className="recurring-category-trigger"/u);
  assert.match(manager, /className="recurring-category-options" role="listbox"/u);
  assert.match(manager, /aria-expanded=\{isCategoryPickerOpen\}/u);
  assert.doesNotMatch(manager, /<span>\{copy\.category\}<\/span><select/u);
  assert.match(navigation, /href: "\/recurring"/u);
  assert.match(schema, /uq_transactions_recurring_occurrence/u);
  assert.match(schema, /pausedAtMs/u);
  assert.match(migration, /"note", NULL, NULL, "client_request_id"/u);
  assert.match(pauseMigration, /"ends_on", NULL, "original_amount_minor"/u);
});

test("supports member-owned monthly category budgets", async () => {
  const [tracker, manager, navigation, route, schema, migration, categoryMigration] = await Promise.all([
    readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/budgets/budget-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ledger-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/budgets/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0008_conscious_franklin_richards.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0012_expanded_budget_categories.sql", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /export const monthlyBudgets/u);
  assert.match(schema, /primaryKey\(\{ columns: \[table\.ownerId, table\.month, table\.category\] \}\)/u);
  assert.match(migration, /CREATE TABLE `monthly_budgets`/u);
  assert.match(route, /memberFromRequest/u);
  assert.match(route, /eq\(monthlyBudgets\.ownerId, ownerId\)/u);
  assert.match(route, /eq\(transactions\.ownerId, ownerId\)/u);
  assert.match(route, /export async function GET/u);
  assert.match(route, /export async function PUT/u);
  assert.match(manager, /EXPENSE_CATEGORY_IDS/u);
  assert.match(route, /EXPENSE_CATEGORY_IDS/u);
  assert.match(route, /D1_BUDGET_INSERT_CHUNK_SIZE = 16/u);
  assert.match(categoryMigration, /'communication'/u);
  assert.match(categoryMigration, /'personal_care'/u);
  assert.match(categoryMigration, /'financial'/u);
  assert.match(manager, /className="budget-category-row"/u);
  assert.match(manager, /copyPreviousMonth/u);
  assert.match(manager, /<LanguagePicker/u);
  assert.match(navigation, /href: "\/budgets"/u);
  assert.match(tracker, /monthlyBudgetUsdMinor/u);
  assert.doesNotMatch(tracker, /const budgetUsdMinor = 350_000/u);
});

test("uses one shared reliable ledger navigation", async () => {
  const [layout, navigation, tracker, recurring, budgets, styles] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ledger-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/recurring/recurring-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/budgets/budget-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /<LedgerNavigation initialLanguage=\{language\}>\{children\}<\/LedgerNavigation>/u);
  assert.match(navigation, /usePathname\(\)/u);
  assert.doesNotMatch(navigation, /import Link from "next\/link"/u);
  assert.match(navigation, /<a href=\{item\.href\}/u);
  assert.match(navigation, /href: "\/reports"/u);
  assert.match(navigation, /href: "\/guide"/u);
  assert.match(navigation, /href: "\/transactions"/u);
  assert.doesNotMatch(navigation, /setNotice\(`\$\{copy\.reports\}/u);
  assert.match(navigation, /className="ledger-mobile-nav"/u);
  assert.match(tracker, /id="transactions"/u);
  assert.doesNotMatch(tracker, /<aside className="sidebar"/u);
  assert.doesNotMatch(recurring, /<aside className="recurring-sidebar"/u);
  assert.doesNotMatch(budgets, /<aside className="budget-sidebar"/u);
  assert.match(styles, /\.ledger-mobile-nav/u);
});

test("provides a localized product guide with direct feature paths", async () => {
  const [page, guide, navigation, metadata, styles] = await Promise.all([
    readFile(new URL("../app/guide/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/guide/guide-content.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ledger-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/page-metadata.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /pageMetadata\("guide"/u);
  assert.match(guide, /Get to know GlobeLedger/u);
  assert.match(guide, /GlobeLedger 사용법/u);
  assert.match(guide, /GlobeLedgerの使い方/u);
  assert.match(guide, /Как пользоваться GlobeLedger/u);
  assert.match(guide, /className="guide-steps"/u);
  assert.match(guide, /className="guide-feature-grid"/u);
  assert.match(guide, /className="guide-faq-list"/u);
  assert.match(guide, /href: "\/budgets"/u);
  assert.match(guide, /href: "\/reports"/u);
  assert.match(navigation, /pathname === "\/guide"/u);
  assert.match(navigation, /<small>\{item\.mobileLabel\}<\/small>/u);
  assert.match(metadata, /guide: "사용 가이드"/u);
  assert.match(styles, /\/\* Product guide \*\//u);
  assert.match(styles, /\.guide-feature-grid/u);
  assert.match(styles, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/u);
});

test("tracks and guides the three account onboarding steps", async () => {
  const [guide, onboardingRoute, preferencesRoute, tracker, budgets, schema, migration, styles] =
    await Promise.all([
      readFile(new URL("../app/guide/guide-content.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/onboarding/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/preferences/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/budgets/budget-manager.tsx", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../drizzle/0013_flimsy_franklin_storm.sql", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);

  assert.match(onboardingRoute, /memberFromRequest/u);
  assert.match(onboardingRoute, /eq\(transactions\.ownerId, member\.id\)/u);
  assert.match(onboardingRoute, /eq\(monthlyBudgets\.ownerId, member\.id\)/u);
  assert.match(onboardingRoute, /completed: completedCount === 3/u);
  assert.match(schema, /baseCurrencyConfiguredAtMs: integer\("base_currency_configured_at_ms"\)/u);
  assert.match(preferencesRoute, /updates\.baseCurrencyConfiguredAtMs = Date\.now\(\)/u);
  assert.match(migration, /"base_currency", NULL, "last_transaction_currency"/u);
  assert.match(guide, /fetch\("\/api\/onboarding"/u);
  assert.match(guide, /role="progressbar"/u);
  assert.match(guide, /\/\?onboarding=currency/u);
  assert.match(guide, /\/\?new=transaction&onboarding=transaction/u);
  assert.match(guide, /\/budgets\?onboarding=budget/u);
  assert.match(tracker, /autoOpen=\{baseCurrencyOnboarding\}/u);
  assert.match(tracker, /setTransactionOnboarding\(onboarding === "transaction"\)/u);
  assert.match(tracker, /window\.location\.assign\("\/guide"\)/u);
  assert.match(budgets, /search\.get\("onboarding"\) !== "budget"/u);
  assert.match(budgets, /onboardingReturn && budgets\.length > 0/u);
  assert.match(styles, /\.onboarding-progress-track/u);
  assert.match(styles, /\.onboarding-complete-card/u);
});

test("filters monthly transactions by search, kind, category, and currency", async () => {
  const [tracker, styles] = await Promise.all([
    readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(tracker, /transactionQuery/u);
  assert.match(tracker, /transactionKindFilter/u);
  assert.match(tracker, /transactionCategoryFilter/u);
  assert.match(tracker, /transactionCurrencyFilter/u);
  assert.match(tracker, /transaction\.note \?\? ""/u);
  assert.match(tracker, /role="search" aria-label=\{copy\.searchTransactions\}/u);
  assert.match(tracker, /visibleTransactions\.map/u);
  assert.match(tracker, /clearTransactionFilters/u);
  assert.match(tracker, /거래 검색/u);
  assert.match(tracker, /取引を検索/u);
  assert.match(tracker, /Поиск операций/u);
  assert.doesNotMatch(tracker, /monthlyTransactions\.slice\(0, 6\)/u);
  assert.match(styles, /\.transaction-filter-bar/u);
  assert.match(styles, /\.transaction-search-field/u);
});

test("shows three recent transactions on the dashboard and full history on its own page", async () => {
  const [tracker, page, navigation, styles] = await Promise.all([
    readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/transactions/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ledger-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(tracker, /slice\(0, 3\)/u);
  assert.match(tracker, /view\?: "dashboard" \| "transactions"/u);
  assert.match(tracker, /href="\/transactions"/u);
  assert.match(tracker, /isTransactionsView && <div className="transaction-filter-bar"/u);
  assert.match(page, /view="transactions"/u);
  assert.match(navigation, /pathname === "\/transactions"/u);
  assert.doesNotMatch(navigation, /\/#transactions/u);
  assert.match(styles, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/u);
});

test("keeps cash-flow and active-currency details inside their metric cards", async () => {
  const [tracker, styles] = await Promise.all([
    readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(tracker, /className="metric-card metric-flow-card">\s*<div className="metric-label"><span>\{copy\.netFlow\}/u);
  assert.match(tracker, /className="metric-card metric-currency-card">\s*<div className="metric-label"><span>\{copy\.activeCurrencies\}/u);
  assert.match(tracker, /className="currency-more"/u);
  assert.match(styles, /\.metric-flow-card,\s*\.metric-currency-card \{[\s\S]*?flex-direction: column/u);
  assert.match(styles, /\.income-pill \{[\s\S]*?margin-top: auto/u);
  assert.match(styles, /\.currency-stack \{[\s\S]*?margin-top: auto/u);
});

test("uses original amounts when the transaction and service currencies match", async () => {
  const tracker = await readFile(
    new URL("../app/expense-tracker.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    tracker,
    /if \(transaction\.originalCurrency === currency\) \{\s*return originalMajor\(transaction\);/u,
  );
  assert.match(tracker, /const displayAmount = transactionInBaseCurrency/u);
  assert.match(tracker, /const conversionRate = currency === baseCurrency\s*\? 1/u);
  assert.match(
    tracker,
    /transaction\.originalCurrency === baseCurrency \? baseCurrency : template\(copy\.convertedTo/u,
  );
});

test("supports transaction-date and current exchange-rate valuations", async () => {
  const [tracker, ratesRoute, historyRoute, transactionRoute, reportsRoute, reportManager, styles] =
    await Promise.all([
      readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/rates/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/rates/history/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/transactions/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/api/reports/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/reports/report-manager.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);

  assert.match(ratesRoute, /endpoint\.searchParams\.set\("date", requestedDate\)/u);
  assert.match(ratesRoute, /readHistoricalSnapshot/u);
  assert.match(ratesRoute, /await writeSnapshots\(db, historicalRates\)/u);
  assert.match(historyRoute, /endpoint\.searchParams\.set\("from"/u);
  assert.match(historyRoute, /direction: "USD_PER_ORIGINAL"/u);
  assert.match(tracker, /type ValuationMode = "historical" \| "current"/u);
  assert.match(tracker, /globeledger-valuation-mode/u);
  assert.match(
    tracker,
    /fetch\(\s*rateEndpoint/u,
  );
  assert.match(tracker, /valuationMode === "current"/u);
  assert.match(tracker, /historicalBaseRates\[transaction\.occurredOn\]/u);
  assert.match(transactionRoute, /proposedBody\.occurredOn === existing\.occurredOn/u);
  assert.match(reportsRoute, /valuationBuckets: valuationRows/u);
  assert.match(reportManager, /const valuedReport = useMemo/u);
  assert.match(reportManager, /historicalBaseRates\[bucket\.occurredOn\]/u);
  assert.match(styles, /\.valuation-switch button\.selected/u);
});

test("provides member-owned monthly cash-flow reports", async () => {
  const [route, manager, navigation, styles] = await Promise.all([
    readFile(new URL("../app/api/reports/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/reports/report-manager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ledger-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(route, /memberFromRequest/u);
  assert.match(route, /eq\(transactions\.ownerId, member\.id\)/u);
  assert.match(route, /groupBy\(transactions\.category\)/u);
  assert.match(route, /groupBy\(transactions\.occurredOn\)/u);
  assert.match(route, /transactions\.originalCurrency/u);
  assert.match(route, /previousSummaryRows/u);
  assert.match(manager, /className="report-summary-grid"/u);
  assert.match(manager, /className="daily-flow-chart"/u);
  assert.match(manager, /className="report-category-list"/u);
  assert.match(manager, /className="report-currency-list"/u);
  assert.match(manager, /className="report-merchant-list"/u);
  assert.match(manager, /\/api\/transactions\?month=/u);
  assert.match(manager, /월간 리포트/u);
  assert.match(manager, /月間レポート/u);
  assert.match(manager, /Месячный отчёт/u);
  assert.match(navigation, /href: "\/reports"/u);
  assert.match(styles, /\.report-grid-primary/u);
  assert.match(styles, /\.daily-flow-chart/u);
});

test("distributes one expense exactly across consecutive calendar dates", async () => {
  const [tracker, route, schema, migration, styles] = await Promise.all([
    readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/transactions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0009_steep_maverick.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /splitGroupId: text\("split_group_id"\)/u);
  assert.match(schema, /transactions_split_shape/u);
  assert.match(schema, /idx_transactions_owner_split_group/u);
  assert.match(route, /function parseDistribution/u);
  assert.match(route, /function distributedTransactionsFromTransaction/u);
  assert.match(route, /D1_TRANSACTION_INSERT_CHUNK_SIZE = 3/u);
  assert.match(route, /MAX_DISTRIBUTION_COUNT = 120/u);
  assert.match(route, /originalEach \+ \(index < originalRemainder \? 1 : 0\)/u);
  assert.match(route, /baseEach \+ \(index < baseRemainder \? 1 : 0\)/u);
  assert.match(route, /shiftIsoDate\(transaction\.occurredOn, index\)/u);
  assert.match(route, /eq\(transactions\.splitGroupId, existing\.splitGroupId\)/u);
  assert.match(migration, /NULL, NULL, NULL, "client_request_id"/u);
  assert.match(tracker, /distribution: \{ count: parsedDistributionCount \}/u);
  assert.match(tracker, /className="distribution-preview"/u);
  assert.match(tracker, /savedTransactions\.map/u);
  assert.match(tracker, /deleteDistributedConfirm/u);
  assert.match(tracker, /날짜별로 분배/u);
  assert.match(tracker, /日付ごとに分割/u);
  assert.match(tracker, /Распределить по датам/u);
  assert.match(styles, /\.distribution-card/u);
});

test("creates exact monthly installment plans with month-end clamping", async () => {
  const [tracker, route, schema, migration, styles, installmentSource] =
    await Promise.all([
      readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/transactions/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../drizzle/0011_monthly_installments.sql", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../lib/installments.ts", import.meta.url), "utf8"),
    ]);
  const installmentModule = await import(
    `data:text/javascript;base64,${Buffer.from(
      ts.transpileModule(installmentSource, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    ).toString("base64")}`
  );

  assert.equal(installmentModule.shiftInstallmentDate("2024-01-31", 1), "2024-02-29");
  assert.equal(installmentModule.shiftInstallmentDate("2024-01-31", 2), "2024-03-31");
  assert.deepEqual(
    Array.from({ length: 3 }, (_, index) =>
      installmentModule.installmentPaymentMinor(100, 3, index),
    ),
    [34, 33, 33],
  );
  assert.equal(installmentModule.installmentRemainingMinor(100, 3, 0), 66);
  assert.equal(installmentModule.installmentRemainingMinor(100, 3, 2), 0);
  assert.match(schema, /installmentGroupId: text\("installment_group_id"\)/u);
  assert.match(schema, /idx_transactions_owner_installment_group/u);
  assert.match(migration, /installment_total_original_minor/u);
  assert.match(route, /function parseInstallment/u);
  assert.match(route, /function installmentTransactionsFromTransaction/u);
  assert.match(route, /INSTALLMENT_STRUCTURE_IMMUTABLE/u);
  assert.match(tracker, /disabled=\{locksInstallmentStructure\}/u);
  assert.match(route, /shiftInstallmentDate\(transaction\.occurredOn, index\)/u);
  assert.match(
    route,
    /eq\([\s\S]*?transactions\.installmentGroupId,[\s\S]*?first\.installmentGroupId/u,
  );
  assert.match(tracker, /installment: \{ count: parsedInstallmentCount \}/u);
  assert.match(tracker, /copy\.installmentRemaining/u);
  assert.match(tracker, /할부 결제/u);
  assert.match(tracker, /分割払い/u);
  assert.match(tracker, /Оплата в рассрочку/u);
  assert.match(styles, /\.installment-card/u);
});

test("materializes recurring entries only when their occurrence date arrives", async () => {
  const route = await readFile(
    new URL("../app/api/transactions/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(route, /const tomorrow = shiftIsoDate/u);
  assert.match(route, /const materializationEnd = monthEnd < tomorrow/u);
  assert.match(route, /recurringDatesForMonth\([\s\S]*?materializationEnd/u);
});

test("adds baseline security headers at the Worker boundary", async () => {
  const worker = await readFile(
    new URL("../worker/index.ts", import.meta.url),
    "utf8",
  );

  assert.match(worker, /Content-Security-Policy/u);
  assert.match(worker, /Strict-Transport-Security/u);
  assert.match(worker, /X-Content-Type-Options/u);
  assert.match(worker, /withSecurityHeaders\(await handler\.fetch/u);
});

test("allows future transactions and locks the latest available rate", async () => {
  const tracker = await readFile(
    new URL("../app/expense-tracker.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    tracker,
    /<input type="date" value=\{occurredOn\} min="1900-01-01"/u,
  );
  assert.doesNotMatch(
    tracker,
    /!isIsoDate\(occurredOn\) \|\| occurredOn > currentDate/u,
  );
  assert.match(
    tracker,
    /const rateEndpoint = occurredOn > currentDate[\s\S]*?\? "\/api\/rates"[\s\S]*?: `\/api\/rates\?date=/u,
  );
  assert.match(
    tracker,
    /isFutureTransaction && hasFrankfurterRate[\s\S]*?copy\.futureRateNotice/u,
  );
});

test("keeps advanced ledger controls behind clear progressive disclosure", async () => {
  const [tracker, navigation, styles] = await Promise.all([
    readFile(new URL("../app/expense-tracker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ledger-navigation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(tracker, /<details className="valuation-disclosure">/u);
  assert.match(tracker, /<details className="conversion-details">/u);
  assert.match(tracker, /<details className="payment-options"/u);
  assert.match(
    tracker,
    /viewMonth === currentDate\.slice\(0, 7\)[\s\S]*?monthlyTransactions\.length === 0/u,
  );
  assert.match(navigation, /copy\.track/u);
  assert.match(navigation, /copy\.planAndReview/u);
  assert.doesNotMatch(navigation, /nav-item pending/u);
  assert.doesNotMatch(navigation, /borderless-note/u);
  assert.match(styles, /\.getting-started/u);
  assert.match(styles, /\.payment-options/u);
});

test("uses a readable minimalist type scale across desktop and mobile", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /body \{[\s\S]*?font-size: 15px;[\s\S]*?line-height: 1\.55;/u);
  assert.match(styles, /\/\* Accessible type scale \*\//u);
  assert.match(styles, /\.nav-item \{[\s\S]*?font-size: 14px;/u);
  assert.match(styles, /\.field input,[\s\S]*?font-size: 14px;/u);
  assert.match(styles, /@media \(max-width: 620px\) \{[\s\S]*?body \{[\s\S]*?font-size: 15px;/u);
  assert.match(styles, /--muted: #42514c;/u);
  assert.match(styles, /\/\* Minimal, light visual treatment \*\//u);
  assert.match(styles, /\.micro-bars \{[\s\S]*?display: none;/u);
  assert.match(styles, /\.nav-item \{[\s\S]*?font-weight: 460;/u);
  assert.match(styles, /\.page-title h1,[\s\S]*?font-weight: 540;/u);
  assert.match(styles, /\.metric-card > strong,[\s\S]*?font-weight: 610;/u);
});

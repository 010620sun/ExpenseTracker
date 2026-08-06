import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the GlobeLedger dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>GlobeLedger — Every currency, one clear picture<\/title>/i);
  assert.match(html, /Every currency, one clear picture\./);
  assert.match(html, /Frankfurter reference rates/);
  assert.match(html, /Updating reference rates/);
  assert.match(html, /Monthly calendar/);
  assert.match(html, /Previous month/);
  assert.match(html, /Next month/);
  assert.match(html, /Spent this month/);
  assert.match(html, /Recent transactions/);
  assert.match(html, /한국어/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);

  const calendarDates = [
    ...html.matchAll(/data-calendar-date="(\d{4}-\d{2}-\d{2})"/gu),
  ].map((match) => match[1]);
  assert.equal(calendarDates.length, 42);
  assert.equal(new Set(calendarDates).size, 42);
  assert.equal(new Date(`${calendarDates[0]}T00:00:00Z`).getUTCDay(), 0);
  assert.equal(
    new Date(`${calendarDates.at(-1)}T00:00:00Z`).getUTCDay(),
    6,
  );
  assert.ok(
    calendarDates.some((date) =>
      date.startsWith(new Date().toISOString().slice(0, 7)),
    ),
  );
  for (let index = 1; index < calendarDates.length; index += 1) {
    const previous = Date.parse(`${calendarDates[index - 1]}T00:00:00Z`);
    const current = Date.parse(`${calendarDates[index]}T00:00:00Z`);
    assert.equal(current - previous, 86_400_000);
  }
});

test("removes starter preview assets and pins product metadata", async () => {
  const [layout, packageJson, hosting] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title: "GlobeLedger/);
  assert.match(packageJson, /"name": "globeledger"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(hosting, /"d1": "DB"/);
  await assert.rejects(access(new URL("../app/_sites-preview", templateRoot)));
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
  const categories = [
    ...optionsBlock[1].matchAll(/"([a-z]+)"/gu),
  ].map((match) => match[1]);
  assert.equal(categories.length, 12);
  assert.equal(new Set(categories).size, categories.length);
  assert.deepEqual(categories.slice(0, 3), ["housing", "groceries", "dining"]);
  assert.match(source, /className="category-popover"/u);
  assert.match(source, /role="listbox"/u);
  assert.match(source, /className="category-option-art"/u);
  assert.doesNotMatch(source, /<select value=\{category\}/u);
  assert.match(styles, /\.category-option-grid/u);
  const categoryPopoverStyles = styles.match(
    /\.category-popover\s*\{([\s\S]*?)\}/u,
  );
  assert.ok(categoryPopoverStyles);
  assert.doesNotMatch(categoryPopoverStyles[1], /overflow-y|max-height/u);
  assert.match(categoryPopoverStyles[1], /position:\s*relative/u);
  assert.doesNotMatch(categoryPopoverStyles[1], /position:\s*absolute/u);
});

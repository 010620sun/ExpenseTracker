import { eq, sql } from "drizzle-orm";

import { getDb, type AppDatabase } from "@/db";
import {
  exchangeRateCache,
  exchangeRateSnapshots,
  type ExchangeRateCache,
} from "@/db/schema";
import {
  currencyExponent,
  currencyName,
  currencySymbol,
  isCurrencyCode,
} from "@/lib/currency";

export const dynamic = "force-dynamic";

const BASE_CURRENCY = "USD";
const MIN_REMOTE_CURRENCY_COUNT = 100;
const MAX_REMOTE_CURRENCY_COUNT = 250;
// D1 limits a statement to 100 bound parameters. Snapshot rows bind seven.
const CACHE_WRITE_CHUNK_SIZE = 10;
const CACHE_TTL_MS = 60 * 60 * 1_000;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_LENGTH = 262_144;
const INVERSE_DECIMAL_PLACES = 12;
const BIGINT_ZERO = BigInt(0);
const BIGINT_TWO = BigInt(2);
const BIGINT_TEN = BigInt(10);
const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
};

type JsonRecord = Record<string, unknown>;

type NormalizedRate = {
  quoteCurrency: string;
  usdPerUnit: string;
  rateDate: string;
  fetchedAtMs: number;
  source: "frankfurter";
};

type CurrencyMetadata = {
  code: string;
  name: string;
  symbol: string;
  exponent: number;
};

function isPlainRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function extractRateTokens(raw: string) {
  const tokens: string[] = [];
  let cursor = 0;

  while (cursor < raw.length) {
    if (raw[cursor] !== '"') {
      cursor += 1;
      continue;
    }

    const stringStart = cursor;
    cursor += 1;
    let escaped = false;
    while (cursor < raw.length) {
      const character = raw[cursor];
      cursor += 1;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        break;
      }
    }

    const encodedString = raw.slice(stringStart, cursor);
    let decodedString: unknown;
    try {
      decodedString = JSON.parse(encodedString);
    } catch {
      throw new Error("Invalid provider JSON string");
    }

    let valueStart = cursor;
    while (/\s/u.test(raw[valueStart] ?? "")) valueStart += 1;
    if (decodedString !== "rate" || raw[valueStart] !== ":") continue;

    valueStart += 1;
    while (/\s/u.test(raw[valueStart] ?? "")) valueStart += 1;
    const numberMatch =
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(
        raw.slice(valueStart),
      );
    if (!numberMatch) throw new Error("Missing provider rate number");

    let valueEnd = valueStart + numberMatch[0].length;
    while (/\s/u.test(raw[valueEnd] ?? "")) valueEnd += 1;
    if (raw[valueEnd] !== "," && raw[valueEnd] !== "}") {
      throw new Error("Invalid provider rate number");
    }

    tokens.push(numberMatch[0]);
    cursor = valueEnd;
  }

  return tokens;
}

function parsePositiveDecimalToken(token: string) {
  if (token.length > 64) throw new Error("Provider rate is too long");

  const match = /^(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u.exec(
    token,
  );
  if (!match) throw new Error("Invalid provider rate token");

  const fraction = match[2] ?? "";
  const exponent = Number(match[3] ?? "0");
  if (
    !Number.isSafeInteger(exponent) ||
    exponent < -30 ||
    exponent > 30 ||
    match[1].length + fraction.length > 30
  ) {
    throw new Error("Provider rate is outside supported precision");
  }

  let numerator = BigInt(`${match[1]}${fraction}`);
  let scale = fraction.length - exponent;
  if (scale < 0) {
    numerator *= BIGINT_TEN ** BigInt(-scale);
    scale = 0;
  }
  while (scale > 0 && numerator % BIGINT_TEN === BIGINT_ZERO) {
    numerator /= BIGINT_TEN;
    scale -= 1;
  }
  if (numerator <= BIGINT_ZERO) throw new Error("Provider rate must be positive");

  return { numerator, scale };
}

function formatScaledDecimal(value: bigint, exponent: number) {
  const scale = BIGINT_TEN ** BigInt(exponent);
  const whole = value / scale;
  let fraction = (value % scale).toString().padStart(exponent, "0");
  fraction = fraction.replace(/0+$/u, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function invertUsdToQuoteRate(token: string) {
  const providerRate = parsePositiveDecimalToken(token);
  const scaledNumerator =
    BIGINT_TEN **
    BigInt(providerRate.scale + INVERSE_DECIMAL_PLACES);
  const rounded =
    (scaledNumerator + providerRate.numerator / BIGINT_TWO) /
    providerRate.numerator;
  if (rounded <= BIGINT_ZERO) throw new Error("Inverted provider rate is zero");

  const normalized = formatScaledDecimal(rounded, INVERSE_DECIMAL_PLACES);
  if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,12})?$/u.test(normalized)) {
    throw new Error("Inverted provider rate is outside supported range");
  }
  return normalized;
}

function snapshotId(rate: Pick<NormalizedRate, "quoteCurrency" | "rateDate" | "usdPerUnit">) {
  return `${rate.quoteCurrency}:${rate.rateDate}:${rate.usdPerUnit}`;
}

async function fetchFrankfurterRates(): Promise<NormalizedRate[]> {
  const endpoint = new URL("https://api.frankfurter.dev/v2/rates");
  endpoint.searchParams.set("base", BASE_CURRENCY);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);

    const raw = await response.text();
    if (!raw || raw.length > MAX_RESPONSE_LENGTH) {
      throw new Error("Provider response size is invalid");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error("Provider returned invalid JSON");
    }
    if (
      !Array.isArray(payload) ||
      payload.length < MIN_REMOTE_CURRENCY_COUNT ||
      payload.length > MAX_REMOTE_CURRENCY_COUNT
    ) {
      throw new Error("Provider response is incomplete");
    }

    const rateTokens = extractRateTokens(raw);
    if (rateTokens.length !== payload.length) {
      throw new Error("Provider rate tokens are incomplete");
    }

    const fetchedAtMs = Date.now();
    const ratesByQuote = new Map<string, NormalizedRate>();
    const seenQuotes = new Set<string>();
    for (const [index, row] of payload.entries()) {
      if (!isPlainRecord(row)) throw new Error("Provider row is invalid");

      const quote = row.quote;
      const rateDate = row.date;
      const numericRate = row.rate;
      const token = rateTokens[index];
      if (
        row.base !== BASE_CURRENCY ||
        !isCurrencyCode(quote) ||
        seenQuotes.has(quote) ||
        typeof rateDate !== "string" ||
        !isValidDate(rateDate) ||
        typeof numericRate !== "number" ||
        !Number.isFinite(numericRate) ||
        numericRate <= 0 ||
        token === undefined ||
        Number(token) !== numericRate
      ) {
        throw new Error("Provider row failed validation");
      }

      seenQuotes.add(quote);
      if (quote === BASE_CURRENCY) {
        if (numericRate !== 1) throw new Error("Provider USD rate is invalid");
        continue;
      }

      ratesByQuote.set(quote, {
        quoteCurrency: quote,
        usdPerUnit: invertUsdToQuoteRate(token),
        rateDate,
        fetchedAtMs,
        source: "frankfurter",
      });
    }

    return [...ratesByQuote.values()].sort((left, right) =>
      left.quoteCurrency.localeCompare(right.quoteCurrency),
    );
  } finally {
    clearTimeout(timeout);
  }
}

function isValidCachedRow(
  row: ExchangeRateCache,
  now: number,
): row is ExchangeRateCache & { quoteCurrency: string } {
  return (
    isCurrencyCode(row.quoteCurrency) &&
    row.quoteCurrency !== BASE_CURRENCY &&
    row.baseCurrency === BASE_CURRENCY &&
    /^(?:0|[1-9]\d{0,8})(?:\.\d{1,12})?$/u.test(row.usdPerUnit) &&
    row.usdPerUnit !== "0" &&
    isValidDate(row.rateDate) &&
    Number.isSafeInteger(row.fetchedAtMs) &&
    row.fetchedAtMs > 0 &&
    row.fetchedAtMs <= now + 5 * 60 * 1_000 &&
    row.source === "frankfurter"
  );
}

async function readCompleteCache(db: AppDatabase, now: number) {
  const rows = await db
    .select()
    .from(exchangeRateCache)
    .where(eq(exchangeRateCache.baseCurrency, BASE_CURRENCY));

  const cohorts = new Map<number, Map<string, ExchangeRateCache>>();
  for (const row of rows) {
    if (!isValidCachedRow(row, now)) continue;
    const cohort = cohorts.get(row.fetchedAtMs) ?? new Map();
    cohort.set(row.quoteCurrency, row);
    cohorts.set(row.fetchedAtMs, cohort);
  }

  for (const [, cohort] of [...cohorts].sort(([left], [right]) => right - left)) {
    if (
      cohort.size >= MIN_REMOTE_CURRENCY_COUNT &&
      cohort.size <= MAX_REMOTE_CURRENCY_COUNT
    ) {
      return [...cohort.values()].sort((left, right) =>
        left.quoteCurrency.localeCompare(right.quoteCurrency),
      );
    }
  }

  return null;
}

async function writeCache(db: AppDatabase, rates: NormalizedRate[]) {
  for (let index = 0; index < rates.length; index += CACHE_WRITE_CHUNK_SIZE) {
    const chunk = rates.slice(index, index + CACHE_WRITE_CHUNK_SIZE);
    await db
      .insert(exchangeRateSnapshots)
      .values(
        chunk.map((rate) => ({
          snapshotId: snapshotId(rate),
          quoteCurrency: rate.quoteCurrency,
          baseCurrency: BASE_CURRENCY,
          usdPerUnit: rate.usdPerUnit,
          rateDate: rate.rateDate,
          fetchedAtMs: rate.fetchedAtMs,
          source: rate.source,
        })),
      )
      .onConflictDoUpdate({
        target: exchangeRateSnapshots.snapshotId,
        set: { fetchedAtMs: chunk[0].fetchedAtMs },
      });
  }

  for (let index = 0; index < rates.length; index += CACHE_WRITE_CHUNK_SIZE) {
    const chunk = rates.slice(index, index + CACHE_WRITE_CHUNK_SIZE);
    await db
      .insert(exchangeRateCache)
      .values(
        chunk.map((rate) => ({
          quoteCurrency: rate.quoteCurrency,
          baseCurrency: BASE_CURRENCY,
          usdPerUnit: rate.usdPerUnit,
          rateDate: rate.rateDate,
          fetchedAtMs: rate.fetchedAtMs,
          source: rate.source,
        })),
      )
      .onConflictDoUpdate({
        target: exchangeRateCache.quoteCurrency,
        set: {
          baseCurrency: sql.raw("excluded.base_currency"),
          usdPerUnit: sql.raw("excluded.usd_per_unit"),
          rateDate: sql.raw("excluded.rate_date"),
          fetchedAtMs: sql.raw("excluded.fetched_at_ms"),
          source: sql.raw("excluded.source"),
        },
      });
  }
}

function rateResponse(
  rows: Array<NormalizedRate | ExchangeRateCache>,
  stale: boolean,
) {
  const rates: Record<string, string> = { USD: "1" };
  const remoteRateDates: Record<string, string> = {};
  let fetchedAtMs = Number.MAX_SAFE_INTEGER;

  for (const row of rows) {
    const quote = row.quoteCurrency;
    rates[quote] = row.usdPerUnit;
    remoteRateDates[quote] = row.rateDate;
    fetchedAtMs = Math.min(fetchedAtMs, row.fetchedAtMs);
  }

  const asOf = Object.values(remoteRateDates).reduce(
    (oldest, date) => (!oldest || date < oldest ? date : oldest),
    "",
  );
  const rateDates = {
    USD: asOf,
    ...remoteRateDates,
  };
  const preferredOrder = new Map(
    ["USD", "KRW", "EUR", "JPY", "GBP"].map((code, index) => [code, index]),
  );
  const currencies = Object.keys(rates)
    .sort((left, right) => {
      const leftRank = preferredOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = preferredOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || left.localeCompare(right);
    })
    .map<CurrencyMetadata>((code) => ({
      code,
      name: currencyName(code),
      symbol: currencySymbol(code),
      exponent: currencyExponent(code) ?? 2,
    }));

  return Response.json(
    {
      data: {
        baseCurrency: BASE_CURRENCY,
        direction: "USD_PER_ORIGINAL",
        rates,
        rateDates,
        currencies,
        asOf,
        fetchedAt: new Date(fetchedAtMs).toISOString(),
        stale,
        source: "frankfurter",
      },
    },
    { headers: RESPONSE_HEADERS },
  );
}

function unavailableResponse() {
  return Response.json(
    { error: { code: "RATES_UNAVAILABLE" } },
    {
      status: 503,
      headers: { ...RESPONSE_HEADERS, "Retry-After": "300" },
    },
  );
}

export async function GET() {
  const now = Date.now();
  const db = getDb();
  let cached: ExchangeRateCache[] | null = null;

  try {
    cached = await readCompleteCache(db, now);
  } catch (error) {
    console.error("[rates] Cache read failed", error);
  }

  if (
    cached &&
    cached.every((row) => now - row.fetchedAtMs < CACHE_TTL_MS)
  ) {
    return rateResponse(cached, false);
  }

  try {
    const liveRates = await fetchFrankfurterRates();
    try {
      await writeCache(db, liveRates);
    } catch (error) {
      console.error("[rates] Cache write failed", error);
      return cached ? rateResponse(cached, true) : unavailableResponse();
    }
    return rateResponse(liveRates, false);
  } catch (error) {
    console.error("[rates] Provider refresh failed", error);
    return cached ? rateResponse(cached, true) : unavailableResponse();
  }
}

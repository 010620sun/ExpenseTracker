import { and, eq, inArray, sql } from "drizzle-orm";

import type { AppDatabase } from "@/db";
import {
  exchangeRatePairs,
  type ExchangeRatePair,
} from "@/db/schema";
import { isCurrencyCode } from "@/lib/currency";

export const FX_BASE_CURRENCY = "USD";
const MIN_FULL_CURRENCY_COUNT = 100;
const MAX_REMOTE_CURRENCY_COUNT = 250;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_LENGTH = 262_144;
const CURRENT_RATE_TTL_MS = 60 * 60 * 1_000;
const CACHE_WRITE_CHUNK_SIZE = 10;
const INVERSE_DECIMAL_PLACES = 12;
const BIGINT_ZERO = BigInt(0);
const BIGINT_TWO = BigInt(2);
const BIGINT_TEN = BigInt(10);

type JsonRecord = Record<string, unknown>;

export type NormalizedRate = {
  quoteCurrency: string;
  usdPerUnit: string;
  rateDate: string;
  fetchedAtMs: number;
  source: "frankfurter";
};

export type ResolvedRateSet = {
  rates: NormalizedRate[];
  stale: boolean;
};

function isPlainRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidRateDate(value: string) {
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
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') break;
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

function parsePositiveDecimal(value: string) {
  if (value.length > 64) throw new Error("Provider rate is too long");
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u.exec(value);
  if (!match) throw new Error("Invalid provider rate");
  const fraction = match[2] ?? "";
  const exponent = Number(match[3] ?? "0") - fraction.length;
  if (
    !Number.isSafeInteger(exponent) ||
    Math.abs(exponent) > 100 ||
    match[1].length + fraction.length > 30
  ) {
    throw new Error("Provider rate exponent is invalid");
  }
  let numerator = BigInt(`${match[1]}${fraction}`);
  let denominator = BigInt(1);
  if (exponent >= 0) numerator *= BIGINT_TEN ** BigInt(exponent);
  else denominator = BIGINT_TEN ** BigInt(-exponent);
  if (numerator <= BIGINT_ZERO) throw new Error("Provider rate is not positive");
  return { numerator, denominator };
}

function formatScaledDecimal(value: bigint, scale: number) {
  const digits = value.toString().padStart(scale + 1, "0");
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/u, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function invertUsdToQuoteRate(value: string) {
  const providerRate = parsePositiveDecimal(value);
  const scaledNumerator =
    providerRate.denominator * BIGINT_TEN ** BigInt(INVERSE_DECIMAL_PLACES);
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

export async function fetchFrankfurterRates(options: {
  requestedDate?: string;
  quotes?: string[];
  requireFullSet?: boolean;
} = {}): Promise<NormalizedRate[]> {
  const requestedQuotes = [...new Set(options.quotes ?? [])]
    .filter((quote) => quote !== FX_BASE_CURRENCY)
    .sort();
  if (requestedQuotes.some((quote) => !isCurrencyCode(quote))) {
    throw new Error("Unsupported requested currency");
  }
  const endpoint = new URL("https://api.frankfurter.dev/v2/rates");
  endpoint.searchParams.set("base", FX_BASE_CURRENCY);
  if (options.requestedDate) endpoint.searchParams.set("date", options.requestedDate);
  if (requestedQuotes.length > 0) {
    endpoint.searchParams.set("quotes", requestedQuotes.join(","));
  }

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
      payload.length > MAX_REMOTE_CURRENCY_COUNT ||
      (options.requireFullSet
        ? payload.length < MIN_FULL_CURRENCY_COUNT
        : payload.length < requestedQuotes.length)
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
      // Ignore non-ISO assets in the unfiltered discovery response.
      if (typeof quote !== "string" || !isCurrencyCode(quote)) continue;
      if (
        row.base !== FX_BASE_CURRENCY ||
        seenQuotes.has(quote) ||
        typeof rateDate !== "string" ||
        !isValidRateDate(rateDate) ||
        typeof numericRate !== "number" ||
        !Number.isFinite(numericRate) ||
        numericRate <= 0 ||
        token === undefined ||
        Number(token) !== numericRate
      ) {
        throw new Error("Provider row failed validation");
      }
      seenQuotes.add(quote);
      if (quote === FX_BASE_CURRENCY) {
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
    if (
      options.requireFullSet &&
      ratesByQuote.size + 1 < MIN_FULL_CURRENCY_COUNT
    ) {
      throw new Error("Provider returned too few supported currencies");
    }
    if (requestedQuotes.some((quote) => !ratesByQuote.has(quote))) {
      throw new Error("Provider omitted a requested currency");
    }
    return [...ratesByQuote.values()].sort((left, right) =>
      left.quoteCurrency.localeCompare(right.quoteCurrency),
    );
  } finally {
    clearTimeout(timeout);
  }
}

function pairKey(requestedDate: string, quoteCurrency: string) {
  return `${requestedDate}:${quoteCurrency}`;
}

function normalizeCachedPair(row: ExchangeRatePair): NormalizedRate {
  return {
    quoteCurrency: row.quoteCurrency,
    usdPerUnit: row.usdPerUnit,
    rateDate: row.rateDate,
    fetchedAtMs: row.fetchedAtMs,
    source: "frankfurter",
  };
}

async function writePairs(
  db: AppDatabase,
  requestedDate: string,
  rates: NormalizedRate[],
) {
  for (let index = 0; index < rates.length; index += CACHE_WRITE_CHUNK_SIZE) {
    const chunk = rates.slice(index, index + CACHE_WRITE_CHUNK_SIZE);
    await db
      .insert(exchangeRatePairs)
      .values(
        chunk.map((rate) => ({
          cacheKey: pairKey(requestedDate, rate.quoteCurrency),
          requestedDate,
          quoteCurrency: rate.quoteCurrency,
          baseCurrency: FX_BASE_CURRENCY,
          usdPerUnit: rate.usdPerUnit,
          rateDate: rate.rateDate,
          fetchedAtMs: rate.fetchedAtMs,
          source: rate.source,
        })),
      )
      .onConflictDoUpdate({
        target: exchangeRatePairs.cacheKey,
        set: {
          usdPerUnit: sql.raw("excluded.usd_per_unit"),
          rateDate: sql.raw("excluded.rate_date"),
          fetchedAtMs: sql.raw("excluded.fetched_at_ms"),
          source: sql.raw("excluded.source"),
        },
      });
  }
}

export async function resolveRequestedRates(
  db: AppDatabase,
  requestedDate: string,
  quotes: string[],
): Promise<ResolvedRateSet> {
  if (!isValidRateDate(requestedDate)) throw new Error("Invalid requested date");
  const requestedQuotes = [...new Set(quotes)]
    .filter((quote) => quote !== FX_BASE_CURRENCY)
    .sort();
  if (
    requestedQuotes.length < 1 ||
    requestedQuotes.length > 4 ||
    requestedQuotes.some((quote) => !isCurrencyCode(quote))
  ) {
    throw new Error("Invalid requested currencies");
  }
  const rows = await db
    .select()
    .from(exchangeRatePairs)
    .where(
      and(
        eq(exchangeRatePairs.requestedDate, requestedDate),
        inArray(exchangeRatePairs.quoteCurrency, requestedQuotes),
      ),
    );
  const cachedByQuote = new Map(rows.map((row) => [row.quoteCurrency, row]));
  const hasAll = requestedQuotes.every((quote) => cachedByQuote.has(quote));
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const refreshable = requestedDate >= today;
  const fresh =
    hasAll &&
    (!refreshable ||
      requestedQuotes.every(
        (quote) => now - cachedByQuote.get(quote)!.fetchedAtMs < CURRENT_RATE_TTL_MS,
      ));
  if (fresh) {
    return {
      rates: requestedQuotes.map((quote) =>
        normalizeCachedPair(cachedByQuote.get(quote)!),
      ),
      stale: false,
    };
  }

  try {
    const fetched = await fetchFrankfurterRates({
      requestedDate: requestedDate <= today ? requestedDate : undefined,
      quotes: requestedQuotes,
    });
    await writePairs(db, requestedDate, fetched);
    return { rates: fetched, stale: false };
  } catch (error) {
    if (hasAll) {
      return {
        rates: requestedQuotes.map((quote) =>
          normalizeCachedPair(cachedByQuote.get(quote)!),
        ),
        stale: true,
      };
    }
    throw error;
  }
}

export async function resolveTransactionRate(
  db: AppDatabase,
  requestedDate: string,
  quoteCurrency: string,
) {
  const resolved = await resolveRequestedRates(db, requestedDate, [quoteCurrency]);
  const rate = resolved.rates[0];
  if (!rate) throw new Error("Transaction rate is unavailable");
  return { ...rate, stale: resolved.stale };
}

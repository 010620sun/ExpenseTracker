import {
  and,
  desc,
  eq,
  gte,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { getDb, type AppDatabase } from "@/db";
import {
  exchangeRateSnapshots,
  exchangeRateCache,
  recurringExceptions,
  recurringSeries,
  transactions,
  userStates,
  type NewRecurringSeries,
  type NewTransaction,
  type RecurringSeries,
  type Transaction,
} from "@/db/schema";
import { currencyExponent } from "@/lib/currency";
import { memberFromRequest } from "@/lib/auth";
import {
  isCategoryForKind,
  isSubcategoryForCategory,
} from "@/lib/categories";

export const dynamic = "force-dynamic";

const BASE_CURRENCY = "USD";
const BASE_CURRENCY_EXPONENT = 2;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_BODY_LENGTH = 16_384;
const BIGINT_ZERO = BigInt(0);
const BIGINT_TWO = BigInt(2);
const BIGINT_TEN = BigInt(10);
const MAX_AMOUNT_MINOR = BigInt("9000000000000");
const TRANSACTION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

type JsonRecord = Record<string, unknown>;

class ApiValidationError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    readonly field?: string,
  ) {
    super(code);
  }
}

type ParsedRate = {
  canonical: string;
  mantissa: bigint;
  scale: number;
};

type Cursor = {
  occurredOn: string;
  createdAtMs: number;
  id: string;
};

type RecurrenceFrequency = "weekly" | "monthly" | "yearly";

type RecurrenceConfig = {
  frequency: RecurrenceFrequency;
  endsOn: string | null;
};

type DistributionConfig = {
  count: number;
};

function errorResponse(code: string, status: number, field?: string) {
  return Response.json(
    { error: { code, ...(field ? { field } : {}) } },
    { status, headers: NO_STORE_HEADERS },
  );
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstDefined(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function normalizeText(
  value: unknown,
  field: string,
  maximumLength: number,
  options: { required?: boolean; fallback?: string } = {},
) {
  if (value === undefined && options.fallback !== undefined) {
    return options.fallback;
  }
  if (typeof value !== "string") {
    throw new ApiValidationError(`INVALID_${field.toUpperCase()}`, 400, field);
  }

  const normalized = value.normalize("NFC").trim();
  if ((options.required && !normalized) || normalized.length > maximumLength) {
    throw new ApiValidationError(`INVALID_${field.toUpperCase()}`, 400, field);
  }
  if (hasControlCharacters(normalized)) {
    throw new ApiValidationError(`INVALID_${field.toUpperCase()}`, 400, field);
  }
  return normalized;
}

function hasControlCharacters(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint <= 31 || codePoint === 127)) {
      return true;
    }
  }
  return false;
}

async function readJsonBody(request: Request): Promise<JsonRecord> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ApiValidationError("UNSUPPORTED_MEDIA_TYPE", 415);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_LENGTH) {
    throw new ApiValidationError("BODY_TOO_LARGE", 413);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_LENGTH) {
    throw new ApiValidationError("BODY_TOO_LARGE", 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiValidationError("INVALID_JSON", 400);
  }
  if (!isPlainRecord(parsed)) {
    throw new ApiValidationError("INVALID_JSON", 400);
  }
  return parsed;
}

async function ownerIdForRequest(request: Request) {
  return (await memberFromRequest(request))?.id ?? null;
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function parseAmount(value: unknown, exponent: number) {
  if (typeof value !== "string") {
    throw new ApiValidationError("INVALID_AMOUNT", 400, "amount");
  }

  const match = /^(0|[1-9]\d{0,14})(?:\.(\d{1,4}))?$/u.exec(value);
  if (!match) {
    throw new ApiValidationError("INVALID_AMOUNT", 400, "amount");
  }

  const fraction = match[2] ?? "";
  if (fraction.length > exponent) {
    throw new ApiValidationError("INVALID_AMOUNT_PRECISION", 400, "amount");
  }

  const minor =
    BigInt(match[1]) * BIGINT_TEN ** BigInt(exponent) +
    BigInt(fraction.padEnd(exponent, "0") || "0");
  if (minor <= BIGINT_ZERO || minor > MAX_AMOUNT_MINOR) {
    throw new ApiValidationError("AMOUNT_OUT_OF_RANGE", 400, "amount");
  }
  return minor;
}

function parseRate(value: unknown): ParsedRate {
  if (typeof value !== "string") {
    throw new ApiValidationError("INVALID_EXCHANGE_RATE", 400, "exchangeRate");
  }

  const match = /^(0|[1-9]\d{0,8})(?:\.(\d{1,12}))?$/u.exec(value);
  if (!match) {
    throw new ApiValidationError("INVALID_EXCHANGE_RATE", 400, "exchangeRate");
  }

  const fraction = (match[2] ?? "").replace(/0+$/u, "");
  const canonical = fraction ? `${match[1]}.${fraction}` : match[1];
  const mantissa = BigInt(`${match[1]}${fraction}`);
  if (mantissa <= BIGINT_ZERO) {
    throw new ApiValidationError("INVALID_EXCHANGE_RATE", 400, "exchangeRate");
  }

  return { canonical, mantissa, scale: fraction.length };
}

function toBaseMinor(
  originalMinor: bigint,
  originalExponent: number,
  rate: ParsedRate,
) {
  const numerator =
    originalMinor *
    rate.mantissa *
    BIGINT_TEN ** BigInt(BASE_CURRENCY_EXPONENT);
  const denominator = BIGINT_TEN ** BigInt(originalExponent + rate.scale);
  const rounded = (numerator + denominator / BIGINT_TWO) / denominator;

  if (rounded > MAX_AMOUNT_MINOR) {
    throw new ApiValidationError(
      "BASE_AMOUNT_OUT_OF_RANGE",
      400,
      "exchangeRate",
    );
  }
  return rounded;
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

function parseExpectedUpdatedAt(value: unknown) {
  if (value === undefined) return null;
  if (typeof value !== "string") {
    throw new ApiValidationError(
      "INVALID_EXPECTED_UPDATED_AT",
      400,
      "expectedUpdatedAt",
    );
  }

  const timestamp = Date.parse(value);
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp <= 0 ||
    new Date(timestamp).toISOString() !== value
  ) {
    throw new ApiValidationError(
      "INVALID_EXPECTED_UPDATED_AT",
      400,
      "expectedUpdatedAt",
    );
  }
  return timestamp;
}

function parseMonth(value: string | null) {
  const month = value ?? new Date().toISOString().slice(0, 7);
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/u.exec(month);
  const year = match ? Number(match[1]) : 0;
  if (!match || year < 1900 || year > 9998) {
    throw new ApiValidationError("INVALID_MONTH", 400, "month");
  }

  const monthNumber = Number(match[2]);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    month,
    start: `${month}-01`,
    end: `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

function parseRecurrence(body: JsonRecord, startOn: string): RecurrenceConfig | null {
  const raw = body.recurrence;
  if (raw === undefined || raw === null || raw === false) return null;
  if (!isPlainRecord(raw)) {
    throw new ApiValidationError("INVALID_RECURRENCE", 400, "recurrence");
  }

  const frequency = raw.frequency;
  if (
    frequency !== "weekly" &&
    frequency !== "monthly" &&
    frequency !== "yearly"
  ) {
    throw new ApiValidationError(
      "INVALID_RECURRENCE_FREQUENCY",
      400,
      "recurrence.frequency",
    );
  }

  const rawEndsOn = raw.endsOn;
  let endsOn: string | null = null;
  if (rawEndsOn !== undefined && rawEndsOn !== null && rawEndsOn !== "") {
    if (
      typeof rawEndsOn !== "string" ||
      !isValidDate(rawEndsOn) ||
      rawEndsOn < startOn
    ) {
      throw new ApiValidationError(
        "INVALID_RECURRENCE_END_DATE",
        400,
        "recurrence.endsOn",
      );
    }
    endsOn = rawEndsOn;
  }

  return { frequency, endsOn };
}

function parseDistribution(
  body: JsonRecord,
  kind: NewTransaction["kind"],
): DistributionConfig | null {
  const raw = body.distribution;
  if (raw === undefined || raw === null || raw === false) return null;
  if (!isPlainRecord(raw)) {
    throw new ApiValidationError("INVALID_DISTRIBUTION", 400, "distribution");
  }
  if (kind !== "expense") {
    throw new ApiValidationError(
      "DISTRIBUTION_REQUIRES_EXPENSE",
      400,
      "distribution",
    );
  }
  const count = raw.count;
  if (!Number.isInteger(count) || Number(count) < 2 || Number(count) > 365) {
    throw new ApiValidationError(
      "INVALID_DISTRIBUTION_COUNT",
      400,
      "distribution.count",
    );
  }
  return { count: Number(count) };
}

function shiftIsoDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function daysInIsoMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function dateInIsoMonth(month: string, preferredDay: number) {
  const day = Math.min(preferredDay, daysInIsoMonth(month));
  return `${month}-${String(day).padStart(2, "0")}`;
}

function recurringDatesForMonth(
  series: RecurringSeries,
  monthStart: string,
  monthEnd: string,
) {
  const dates: string[] = [];
  const withinSeries = (date: string) =>
    date >= series.startOn &&
    date < monthEnd &&
    (series.endsOn === null || date <= series.endsOn);

  if (series.frequency === "weekly") {
    const startMs = Date.parse(`${series.startOn}T00:00:00Z`);
    const monthMs = Date.parse(`${monthStart}T00:00:00Z`);
    const weeksToMonth = Math.max(
      0,
      Math.ceil((monthMs - startMs) / (7 * 86_400_000)),
    );
    for (
      let date = shiftIsoDate(series.startOn, weeksToMonth * 7);
      date < monthEnd;
      date = shiftIsoDate(date, 7)
    ) {
      if (date >= monthStart && withinSeries(date)) dates.push(date);
    }
    return dates;
  }

  const targetMonth = monthStart.slice(0, 7);
  const startMonth = series.startOn.slice(0, 7);
  if (targetMonth < startMonth) return dates;

  if (series.frequency === "monthly") {
    const date = dateInIsoMonth(targetMonth, Number(series.startOn.slice(8)));
    if (withinSeries(date)) dates.push(date);
    return dates;
  }

  if (targetMonth.slice(5) === startMonth.slice(5)) {
    const date = dateInIsoMonth(targetMonth, Number(series.startOn.slice(8)));
    if (withinSeries(date)) dates.push(date);
  }
  return dates;
}

function parseLimit(value: string | null) {
  if (value === null) return DEFAULT_LIMIT;
  if (!/^\d{1,3}$/u.test(value)) {
    throw new ApiValidationError("INVALID_LIMIT", 400, "limit");
  }
  const limit = Number(value);
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new ApiValidationError("INVALID_LIMIT", 400, "limit");
  }
  return limit;
}

function decodeCursor(value: string | null): Cursor | null {
  if (!value) return null;
  if (value.length > 512) {
    throw new ApiValidationError("INVALID_CURSOR", 400, "cursor");
  }

  try {
    const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const parsed: unknown = JSON.parse(atob(padded));
    if (!isPlainRecord(parsed)) throw new Error("invalid cursor");

    const occurredOn = parsed.occurredOn;
    const createdAtMs = parsed.createdAtMs;
    const id = parsed.id;
    if (
      typeof occurredOn !== "string" ||
      !isValidDate(occurredOn) ||
      typeof createdAtMs !== "number" ||
      !Number.isSafeInteger(createdAtMs) ||
      createdAtMs <= 0 ||
      typeof id !== "string" ||
      id.length < 1 ||
      id.length > 64
    ) {
      throw new Error("invalid cursor");
    }
    return { occurredOn, createdAtMs, id };
  } catch {
    throw new ApiValidationError("INVALID_CURSOR", 400, "cursor");
  }
}

function encodeCursor(transaction: Transaction) {
  return btoa(
    JSON.stringify({
      occurredOn: transaction.occurredOn,
      createdAtMs: transaction.createdAtMs,
      id: transaction.id,
    } satisfies Cursor),
  )
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
}

function formatMinor(value: number, exponent: number) {
  const minor = BigInt(value);
  if (exponent === 0) return minor.toString();

  const scale = BIGINT_TEN ** BigInt(exponent);
  const whole = minor / scale;
  const fraction = (minor % scale).toString().padStart(exponent, "0");
  return `${whole}.${fraction}`;
}

function serializeTransaction(transaction: Transaction) {
  return {
    id: transaction.id,
    kind: transaction.kind,
    occurredOn: transaction.occurredOn,
    amount: formatMinor(
      transaction.originalAmountMinor,
      transaction.originalCurrencyExponent,
    ),
    amountMinor: String(transaction.originalAmountMinor),
    originalAmountMinor: transaction.originalAmountMinor,
    currency: transaction.originalCurrency,
    originalCurrency: transaction.originalCurrency,
    currencyExponent: transaction.originalCurrencyExponent,
    originalExponent: transaction.originalCurrencyExponent,
    exchangeRate: transaction.fxRate,
    fxRate: transaction.fxRate,
    exchangeRateDirection: "USD_PER_ORIGINAL" as const,
    exchangeRateSource: transaction.fxSource,
    exchangeRateDate: transaction.fxRateDate,
    fxRateDate: transaction.fxRateDate,
    rateDate: transaction.fxRateDate,
    exchangeRateCapturedAt: new Date(
      transaction.fxCapturedAtMs,
    ).toISOString(),
    baseAmount: formatMinor(
      transaction.baseAmountMinor,
      transaction.baseCurrencyExponent,
    ),
    baseAmountMinor: transaction.baseAmountMinor,
    baseAmountMinorText: String(transaction.baseAmountMinor),
    baseCurrency: transaction.baseCurrency,
    baseCurrencyExponent: transaction.baseCurrencyExponent,
    category: transaction.category,
    subcategory: transaction.subcategory,
    description: transaction.description,
    note: transaction.note,
    recurringSeriesId: transaction.recurringSeriesId,
    recurrenceDate: transaction.recurrenceDate,
    isRecurring: transaction.recurringSeriesId !== null,
    splitGroupId: transaction.splitGroupId,
    splitIndex: transaction.splitIndex,
    splitCount: transaction.splitCount,
    isDistributed: transaction.splitGroupId !== null,
    createdAt: new Date(transaction.createdAtMs).toISOString(),
    updatedAt: new Date(transaction.updatedAtMs).toISOString(),
  };
}

async function ensureUserState(db: AppDatabase, ownerId: string) {
  await db
    .insert(userStates)
    .values({ ownerId, createdAtMs: Date.now() })
    .onConflictDoNothing();
}

async function rememberLastTransactionCurrency(
  db: AppDatabase,
  ownerId: string,
  currency: string,
) {
  await db
    .update(userStates)
    .set({ lastTransactionCurrency: currency })
    .where(eq(userStates.ownerId, ownerId));
}

function recurringSeriesFromTransaction(
  transaction: NewTransaction,
  recurrence: RecurrenceConfig,
): NewRecurringSeries {
  return {
    id: transaction.id,
    ownerId: transaction.ownerId,
    kind: transaction.kind,
    startOn: transaction.occurredOn,
    frequency: recurrence.frequency,
    endsOn: recurrence.endsOn,
    pausedAtMs: null,
    originalAmountMinor: transaction.originalAmountMinor,
    originalCurrency: transaction.originalCurrency,
    originalCurrencyExponent: transaction.originalCurrencyExponent,
    fallbackFxRate: transaction.fxRate,
    fallbackFxSource:
      transaction.fxSource === "sample" ? "manual" : transaction.fxSource,
    fallbackFxRateDate:
      transaction.fxSource === "frankfurter" ? transaction.fxRateDate : null,
    category: transaction.category,
    subcategory: transaction.subcategory,
    description: transaction.description,
    note: transaction.note,
    createdAtMs: transaction.createdAtMs,
    updatedAtMs: transaction.updatedAtMs,
  };
}

async function materializeRecurringTransactions(
  db: AppDatabase,
  ownerId: string,
  monthStart: string,
  monthEnd: string,
) {
  const seriesRows = await db
    .select()
    .from(recurringSeries)
    .where(
      and(
        eq(recurringSeries.ownerId, ownerId),
        isNull(recurringSeries.pausedAtMs),
        lt(recurringSeries.startOn, monthEnd),
        or(
          isNull(recurringSeries.endsOn),
          gte(recurringSeries.endsOn, monthStart),
        ),
      ),
    );
  if (seriesRows.length === 0) return;

  const [exceptionRows, cacheRows] = await db.batch([
    db
      .select({
        seriesId: recurringExceptions.seriesId,
        occurrenceOn: recurringExceptions.occurrenceOn,
      })
      .from(recurringExceptions)
      .where(
        and(
          eq(recurringExceptions.ownerId, ownerId),
          gte(recurringExceptions.occurrenceOn, monthStart),
          lt(recurringExceptions.occurrenceOn, monthEnd),
        ),
      ),
    db.select().from(exchangeRateCache),
  ]);
  const exceptions = new Set(
    exceptionRows.map((row) => `${row.seriesId}:${row.occurrenceOn}`),
  );
  const ratesByCurrency = new Map(
    cacheRows.map((row) => [row.quoteCurrency, row]),
  );
  const generated: NewTransaction[] = [];
  const generatedAtMs = Date.now();

  for (const series of seriesRows) {
    for (const occurrenceOn of recurringDatesForMonth(
      series,
      monthStart,
      monthEnd,
    )) {
      if (exceptions.has(`${series.id}:${occurrenceOn}`)) continue;

      const currentRate = ratesByCurrency.get(series.originalCurrency);
      const fxRate =
        series.originalCurrency === BASE_CURRENCY
          ? "1"
          : currentRate?.usdPerUnit ?? series.fallbackFxRate;
      const fxSource =
        series.originalCurrency === BASE_CURRENCY
          ? "identity"
          : currentRate
            ? "frankfurter"
            : series.fallbackFxSource;
      const fxRateDate =
        fxSource === "frankfurter"
          ? currentRate?.rateDate ?? series.fallbackFxRateDate
          : null;
      const parsedRate = parseRate(fxRate);
      const originalMinor = BigInt(series.originalAmountMinor);
      const baseMinor =
        series.originalCurrency === BASE_CURRENCY
          ? originalMinor
          : toBaseMinor(
              originalMinor,
              series.originalCurrencyExponent,
              parsedRate,
            );
      const timestamp = generatedAtMs + generated.length;
      generated.push({
        id: crypto.randomUUID(),
        ownerId,
        kind: series.kind,
        occurredOn: occurrenceOn,
        originalAmountMinor: series.originalAmountMinor,
        originalCurrency: series.originalCurrency,
        originalCurrencyExponent: series.originalCurrencyExponent,
        fxRate: parsedRate.canonical,
        fxSource,
        fxRateDate,
        fxCapturedAtMs: currentRate?.fetchedAtMs ?? series.createdAtMs,
        baseAmountMinor: Number(baseMinor),
        baseCurrency: BASE_CURRENCY,
        baseCurrencyExponent: BASE_CURRENCY_EXPONENT,
        category: series.category,
        subcategory: series.subcategory,
        description: series.description,
        note: series.note,
        recurringSeriesId: series.id,
        recurrenceDate: occurrenceOn,
        splitGroupId: null,
        splitIndex: null,
        splitCount: null,
        clientRequestId: `rec:${series.id}:${occurrenceOn}`,
        createdAtMs: timestamp,
        updatedAtMs: timestamp,
      });
    }
  }

  for (let index = 0; index < generated.length; index += 4) {
    await db
      .insert(transactions)
      .values(generated.slice(index, index + 4))
      .onConflictDoNothing();
  }
}

async function buildNewTransaction(
  ownerId: string,
  body: JsonRecord,
  db: AppDatabase,
): Promise<NewTransaction> {
  const rawKind = firstDefined(body, ["kind", "type"]);
  const kind =
    typeof rawKind === "string" ? rawKind.trim().toLowerCase() : "";
  if (kind !== "expense" && kind !== "income") {
    throw new ApiValidationError("INVALID_KIND", 400, "kind");
  }

  const rawDate = firstDefined(body, ["occurredOn", "date"]);
  if (typeof rawDate !== "string" || !isValidDate(rawDate)) {
    throw new ApiValidationError("INVALID_DATE", 400, "occurredOn");
  }

  const rawCurrency = body.currency;
  if (typeof rawCurrency !== "string") {
    throw new ApiValidationError("INVALID_CURRENCY", 400, "currency");
  }
  const currency = rawCurrency.trim().toUpperCase();
  const exponent = currencyExponent(currency);
  if (exponent === null) {
    throw new ApiValidationError("UNSUPPORTED_CURRENCY", 400, "currency");
  }

  const originalMinor = parseAmount(body.amount, exponent);
  const rawSource = firstDefined(body, [
    "exchangeRateSource",
    "fxSource",
    "rateSource",
  ]);
  const requestedSource =
    typeof rawSource === "string" ? rawSource.trim().toLowerCase() : rawSource;
  let fxSource: "identity" | "manual" | "frankfurter";
  if (currency === BASE_CURRENCY) {
    if (requestedSource !== undefined && requestedSource !== "identity") {
      throw new ApiValidationError(
        "INVALID_EXCHANGE_RATE_SOURCE",
        400,
        "fxSource",
      );
    }
    fxSource = "identity";
  } else {
    if (requestedSource === undefined || requestedSource === "manual") {
      fxSource = "manual";
    } else if (requestedSource === "frankfurter") {
      fxSource = "frankfurter";
    } else {
      throw new ApiValidationError(
        "INVALID_EXCHANGE_RATE_SOURCE",
        400,
        "fxSource",
      );
    }
  }

  const rawRateDate = firstDefined(body, [
    "rateDate",
    "fxRateDate",
    "exchangeRateDate",
  ]);
  let fxRateDate: string | null = null;
  if (fxSource === "frankfurter") {
    if (typeof rawRateDate !== "string" || !isValidDate(rawRateDate)) {
      throw new ApiValidationError("INVALID_RATE_DATE", 400, "rateDate");
    }
    fxRateDate = rawRateDate;
  } else if (rawRateDate !== undefined && rawRateDate !== null) {
    throw new ApiValidationError("INVALID_RATE_DATE", 400, "rateDate");
  }

  const rawRate = firstDefined(body, ["exchangeRate", "fxRate", "rate"]);
  let rate = parseRate(
    rawRate === undefined && currency === BASE_CURRENCY ? "1" : rawRate,
  );
  if (currency === BASE_CURRENCY && rate.canonical !== "1") {
    throw new ApiValidationError(
      "INVALID_IDENTITY_EXCHANGE_RATE",
      400,
      "exchangeRate",
    );
  }

  if (fxSource === "frankfurter") {
    const snapshotId = `${currency}:${fxRateDate}:${rate.canonical}`;
    const snapshotRows = await db
      .select({
        quoteCurrency: exchangeRateSnapshots.quoteCurrency,
        usdPerUnit: exchangeRateSnapshots.usdPerUnit,
        rateDate: exchangeRateSnapshots.rateDate,
      })
      .from(exchangeRateSnapshots)
      .where(eq(exchangeRateSnapshots.snapshotId, snapshotId))
      .limit(1);
    const snapshot = snapshotRows[0];
    if (!snapshot) {
      throw new ApiValidationError(
        "FRANKFURTER_RATE_UNAVAILABLE",
        409,
        "currency",
      );
    }

    const authoritativeRate = parseRate(snapshot.usdPerUnit);
    if (
      snapshot.quoteCurrency !== currency ||
      rate.canonical !== authoritativeRate.canonical ||
      fxRateDate !== snapshot.rateDate
    ) {
      throw new ApiValidationError(
        "RATE_SNAPSHOT_CHANGED",
        409,
        "exchangeRate",
      );
    }
    rate = authoritativeRate;
    fxRateDate = snapshot.rateDate;
  }

  const baseMinor =
    currency === BASE_CURRENCY
      ? originalMinor
      : toBaseMinor(originalMinor, exponent, rate);

  const category = normalizeText(body.category, "category", 40, {
    fallback: kind === "income" ? "other_income" : "other",
  });
  if (!isCategoryForKind(category, kind)) {
    throw new ApiValidationError("INVALID_CATEGORY", 400, "category");
  }
  const normalizedSubcategory = normalizeText(
    body.subcategory,
    "subcategory",
    64,
    { fallback: "" },
  );
  if (
    normalizedSubcategory &&
    !isSubcategoryForCategory(category, normalizedSubcategory)
  ) {
    throw new ApiValidationError(
      "INVALID_SUBCATEGORY",
      400,
      "subcategory",
    );
  }
  const subcategory = normalizedSubcategory || null;
  const description = normalizeText(
    firstDefined(body, ["description", "merchant"]),
    "description",
    120,
    { required: true },
  );
  const note = normalizeText(body.note, "note", 500, { fallback: "" });

  const rawClientRequestId = body.clientRequestId;
  let clientRequestId: string | null = null;
  if (rawClientRequestId !== undefined) {
    if (
      typeof rawClientRequestId !== "string" ||
      !/^[A-Za-z0-9._:-]{1,64}$/u.test(rawClientRequestId)
    ) {
      throw new ApiValidationError(
        "INVALID_CLIENT_REQUEST_ID",
        400,
        "clientRequestId",
      );
    }
    clientRequestId = rawClientRequestId;
  }

  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    ownerId,
    kind,
    occurredOn: rawDate,
    originalAmountMinor: Number(originalMinor),
    originalCurrency: currency,
    originalCurrencyExponent: exponent,
    fxRate: rate.canonical,
    fxSource,
    fxRateDate,
    fxCapturedAtMs: now,
    baseAmountMinor: Number(baseMinor),
    baseCurrency: BASE_CURRENCY,
    baseCurrencyExponent: BASE_CURRENCY_EXPONENT,
    category,
    subcategory,
    description,
    note,
    recurringSeriesId: null,
    recurrenceDate: null,
    splitGroupId: null,
    splitIndex: null,
    splitCount: null,
    clientRequestId,
    createdAtMs: now,
    updatedAtMs: now,
  };
}

function distributedTransactionsFromTransaction(
  transaction: NewTransaction,
  distribution: DistributionConfig,
) {
  const count = distribution.count;
  if (
    transaction.originalAmountMinor < count ||
    transaction.baseAmountMinor < count
  ) {
    throw new ApiValidationError(
      "DISTRIBUTION_AMOUNT_TOO_SMALL",
      400,
      "distribution.count",
    );
  }

  const groupId = crypto.randomUUID();
  const originalEach = Math.floor(transaction.originalAmountMinor / count);
  const originalRemainder = transaction.originalAmountMinor % count;
  const baseEach = Math.floor(transaction.baseAmountMinor / count);
  const baseRemainder = transaction.baseAmountMinor % count;
  return Array.from({ length: count }, (_, index): NewTransaction => ({
    ...transaction,
    id: crypto.randomUUID(),
    occurredOn: shiftIsoDate(transaction.occurredOn, index),
    originalAmountMinor: originalEach + (index < originalRemainder ? 1 : 0),
    baseAmountMinor: baseEach + (index < baseRemainder ? 1 : 0),
    recurringSeriesId: null,
    recurrenceDate: null,
    splitGroupId: groupId,
    splitIndex: index,
    splitCount: count,
    clientRequestId:
      index === 0
        ? transaction.clientRequestId
        : `split:${groupId}:${index}`,
    createdAtMs: transaction.createdAtMs + index,
    updatedAtMs: transaction.updatedAtMs + index,
  }));
}

function sameDistribution(
  existing: Transaction[],
  proposed: NewTransaction,
  count: number,
) {
  if (
    existing.length !== count ||
    existing.some(
      (row) =>
        row.splitCount !== count ||
        row.splitGroupId !== existing[0]?.splitGroupId,
    )
  ) {
    return false;
  }
  const ordered = [...existing].sort(
    (left, right) => (left.splitIndex ?? 0) - (right.splitIndex ?? 0),
  );
  return (
    ordered[0]?.occurredOn === proposed.occurredOn &&
    ordered.every(
      (row, index) =>
        row.occurredOn === shiftIsoDate(proposed.occurredOn, index) &&
        row.kind === proposed.kind &&
        row.originalCurrency === proposed.originalCurrency &&
        row.originalCurrencyExponent === proposed.originalCurrencyExponent &&
        row.fxRate === proposed.fxRate &&
        row.fxSource === proposed.fxSource &&
        row.fxRateDate === proposed.fxRateDate &&
        row.baseCurrency === proposed.baseCurrency &&
        row.baseCurrencyExponent === proposed.baseCurrencyExponent &&
        row.category === proposed.category &&
        row.subcategory === proposed.subcategory &&
        row.description === proposed.description &&
        row.note === proposed.note
    ) &&
    ordered.reduce((sum, row) => sum + row.originalAmountMinor, 0) ===
      proposed.originalAmountMinor &&
    ordered.reduce((sum, row) => sum + row.baseAmountMinor, 0) ===
      proposed.baseAmountMinor
  );
}

function sameMutation(existing: Transaction, proposed: NewTransaction) {
  return (
    existing.kind === proposed.kind &&
    existing.occurredOn === proposed.occurredOn &&
    existing.originalAmountMinor === proposed.originalAmountMinor &&
    existing.originalCurrency === proposed.originalCurrency &&
    existing.originalCurrencyExponent === proposed.originalCurrencyExponent &&
    existing.fxRate === proposed.fxRate &&
    existing.fxSource === proposed.fxSource &&
    existing.fxRateDate === proposed.fxRateDate &&
    existing.baseAmountMinor === proposed.baseAmountMinor &&
    existing.baseCurrency === proposed.baseCurrency &&
    existing.baseCurrencyExponent === proposed.baseCurrencyExponent &&
    existing.category === proposed.category &&
    existing.subcategory === proposed.subcategory &&
    existing.description === proposed.description &&
    existing.note === proposed.note
  );
}

export async function GET(request: Request) {
  try {
    const ownerId = await ownerIdForRequest(request);
    if (!ownerId) return errorResponse("AUTH_REQUIRED", 401);

    const url = new URL(request.url);
    const monthRange = parseMonth(url.searchParams.get("month"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const cursor = decodeCursor(url.searchParams.get("cursor"));
    const db = getDb();

    await materializeRecurringTransactions(
      db,
      ownerId,
      monthRange.start,
      monthRange.end,
    );

    const predicates = [
      eq(transactions.ownerId, ownerId),
      gte(transactions.occurredOn, monthRange.start),
      lt(transactions.occurredOn, monthRange.end),
    ];
    if (cursor) {
      predicates.push(
        or(
          lt(transactions.occurredOn, cursor.occurredOn),
          and(
            eq(transactions.occurredOn, cursor.occurredOn),
            lt(transactions.createdAtMs, cursor.createdAtMs),
          ),
          and(
            eq(transactions.occurredOn, cursor.occurredOn),
            eq(transactions.createdAtMs, cursor.createdAtMs),
            lt(transactions.id, cursor.id),
          ),
        )!,
      );
    }

    const pageQuery = db
      .select()
      .from(transactions)
      .where(and(...predicates))
      .orderBy(
        desc(transactions.occurredOn),
        desc(transactions.createdAtMs),
        desc(transactions.id),
      )
      .limit(limit + 1);

    const summaryQuery = db
      .select({
        incomeMinor: sql<string>`CAST(COALESCE(SUM(CASE WHEN ${transactions.kind} = 'income' THEN ${transactions.baseAmountMinor} ELSE 0 END), 0) AS TEXT)`,
        expenseMinor: sql<string>`CAST(COALESCE(SUM(CASE WHEN ${transactions.kind} = 'expense' THEN ${transactions.baseAmountMinor} ELSE 0 END), 0) AS TEXT)`,
        netMinor: sql<string>`CAST(COALESCE(SUM(CASE WHEN ${transactions.kind} = 'income' THEN ${transactions.baseAmountMinor} ELSE -${transactions.baseAmountMinor} END), 0) AS TEXT)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.ownerId, ownerId),
          gte(transactions.occurredOn, monthRange.start),
          lt(transactions.occurredOn, monthRange.end),
        ),
      );

    const [pageRows, summaryRows] = await db.batch([pageQuery, summaryQuery]);
    const hasMore = pageRows.length > limit;
    const visibleRows = hasMore ? pageRows.slice(0, limit) : pageRows;
    const summary = summaryRows[0] ?? {
      incomeMinor: "0",
      expenseMinor: "0",
      netMinor: "0",
      count: 0,
    };

    return Response.json(
      {
        data: visibleRows.map(serializeTransaction),
        summary: {
          month: monthRange.month,
          currency: BASE_CURRENCY,
          currencyExponent: BASE_CURRENCY_EXPONENT,
          incomeMinor: String(summary.incomeMinor),
          expenseMinor: String(summary.expenseMinor),
          netMinor: String(summary.netMinor),
          count: Number(summary.count),
        },
        pagination: {
          limit,
          nextCursor:
            hasMore && visibleRows.length > 0
              ? encodeCursor(visibleRows[visibleRows.length - 1])
              : null,
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return errorResponse(error.code, error.status, error.field);
    }
    console.error("[transactions] GET failed", error);
    return errorResponse("INTERNAL_ERROR", 500);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return errorResponse("CROSS_ORIGIN_REQUEST", 403);
    }

    const ownerId = await ownerIdForRequest(request);
    if (!ownerId) return errorResponse("AUTH_REQUIRED", 401);

    const body = await readJsonBody(request);
    const db = getDb();
    const newTransaction = await buildNewTransaction(ownerId, body, db);
    const recurrence = parseRecurrence(body, newTransaction.occurredOn);
    const distribution = parseDistribution(body, newTransaction.kind);
    if (recurrence && distribution) {
      throw new ApiValidationError(
        "RECURRENCE_DISTRIBUTION_CONFLICT",
        400,
        "distribution",
      );
    }
    await ensureUserState(db, ownerId);

    if (distribution) {
      if (newTransaction.clientRequestId) {
        const firstRows = await db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, ownerId),
              eq(
                transactions.clientRequestId,
                newTransaction.clientRequestId,
              ),
            ),
          )
          .limit(1);
        const first = firstRows[0];
        if (first) {
          const existing = first.splitGroupId
            ? await db
                .select()
                .from(transactions)
                .where(
                  and(
                    eq(transactions.ownerId, ownerId),
                    eq(transactions.splitGroupId, first.splitGroupId),
                  ),
                )
            : [first];
          if (sameDistribution(existing, newTransaction, distribution.count)) {
            await rememberLastTransactionCurrency(
              db,
              ownerId,
              first.originalCurrency,
            );
            return Response.json(
              {
                data: existing
                  .sort(
                    (left, right) =>
                      (left.splitIndex ?? 0) - (right.splitIndex ?? 0),
                  )
                  .map(serializeTransaction),
                idempotent: true,
              },
              { status: 200, headers: NO_STORE_HEADERS },
            );
          }
          return errorResponse("IDEMPOTENCY_CONFLICT", 409, "clientRequestId");
        }
      }

      const distributed = distributedTransactionsFromTransaction(
        newTransaction,
        distribution,
      );
      const insertQueries = [];
      for (let index = 0; index < distributed.length; index += 4) {
        insertQueries.push(
          db
            .insert(transactions)
            .values(distributed.slice(index, index + 4))
            .returning(),
        );
      }
      const [firstInsert, ...remainingInserts] = insertQueries;
      const insertedBatches = await db.batch([
        firstInsert,
        ...remainingInserts,
      ]);
      const inserted = insertedBatches.flat();
      await rememberLastTransactionCurrency(
        db,
        ownerId,
        inserted[0].originalCurrency,
      );
      return Response.json(
        { data: inserted.map(serializeTransaction) },
        { status: 201, headers: NO_STORE_HEADERS },
      );
    }

    if (recurrence) {
      if (newTransaction.clientRequestId) {
        const existing = await db
          .select()
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, ownerId),
              eq(
                transactions.clientRequestId,
                newTransaction.clientRequestId,
              ),
            ),
          )
          .limit(1);
        if (existing[0]) {
          const existingSeries = existing[0].recurringSeriesId
            ? await db
                .select({
                  frequency: recurringSeries.frequency,
                  endsOn: recurringSeries.endsOn,
                })
                .from(recurringSeries)
                .where(
                  and(
                    eq(recurringSeries.id, existing[0].recurringSeriesId),
                    eq(recurringSeries.ownerId, ownerId),
                  ),
                )
                .limit(1)
            : [];
          if (
            sameMutation(existing[0], newTransaction) &&
            existingSeries[0]?.frequency === recurrence.frequency &&
            existingSeries[0]?.endsOn === recurrence.endsOn
          ) {
            await rememberLastTransactionCurrency(
              db,
              ownerId,
              existing[0].originalCurrency,
            );
            return Response.json(
              { data: serializeTransaction(existing[0]), idempotent: true },
              { status: 200, headers: NO_STORE_HEADERS },
            );
          }
          return errorResponse("IDEMPOTENCY_CONFLICT", 409, "clientRequestId");
        }
      }

      const series = recurringSeriesFromTransaction(newTransaction, recurrence);
      newTransaction.recurringSeriesId = series.id;
      newTransaction.recurrenceDate = newTransaction.occurredOn;
      const [, insertedRows] = await db.batch([
        db.insert(recurringSeries).values(series),
        db.insert(transactions).values(newTransaction).returning(),
      ]);
      await rememberLastTransactionCurrency(
        db,
        ownerId,
        insertedRows[0].originalCurrency,
      );
      return Response.json(
        { data: serializeTransaction(insertedRows[0]) },
        { status: 201, headers: NO_STORE_HEADERS },
      );
    }

    if (newTransaction.clientRequestId) {
      const inserted = await db
        .insert(transactions)
        .values(newTransaction)
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) {
        await rememberLastTransactionCurrency(
          db,
          ownerId,
          inserted[0].originalCurrency,
        );
        return Response.json(
          { data: serializeTransaction(inserted[0]) },
          { status: 201, headers: NO_STORE_HEADERS },
        );
      }

      const existing = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.ownerId, ownerId),
            eq(
              transactions.clientRequestId,
              newTransaction.clientRequestId,
            ),
          ),
        )
        .limit(1);
      if (
        existing[0] &&
        existing[0].recurringSeriesId === null &&
        sameMutation(existing[0], newTransaction)
      ) {
        await rememberLastTransactionCurrency(
          db,
          ownerId,
          existing[0].originalCurrency,
        );
        return Response.json(
          { data: serializeTransaction(existing[0]), idempotent: true },
          { status: 200, headers: NO_STORE_HEADERS },
        );
      }
      return errorResponse("IDEMPOTENCY_CONFLICT", 409, "clientRequestId");
    }

    const inserted = await db
      .insert(transactions)
      .values(newTransaction)
      .returning();
    await rememberLastTransactionCurrency(
      db,
      ownerId,
      inserted[0].originalCurrency,
    );
    return Response.json(
      { data: serializeTransaction(inserted[0]) },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return errorResponse(error.code, error.status, error.field);
    }
    console.error("[transactions] POST failed", error);
    return errorResponse("INTERNAL_ERROR", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return errorResponse("CROSS_ORIGIN_REQUEST", 403);
    }

    const ownerId = await ownerIdForRequest(request);
    if (!ownerId) return errorResponse("AUTH_REQUIRED", 401);

    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!TRANSACTION_ID_PATTERN.test(id)) {
      return errorResponse("INVALID_TRANSACTION_ID", 400, "id");
    }

    const body = await readJsonBody(request);
    const expectedUpdatedAt = parseExpectedUpdatedAt(body.expectedUpdatedAt);
    const db = getDb();
    const existingRows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.ownerId, ownerId)))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) return errorResponse("TRANSACTION_NOT_FOUND", 404);
    if (
      expectedUpdatedAt !== null &&
      expectedUpdatedAt !== existing.updatedAtMs
    ) {
      return errorResponse("TRANSACTION_CHANGED", 409, "expectedUpdatedAt");
    }

    const proposedBody: JsonRecord = { ...body };
    delete proposedBody.clientRequestId;
    if (proposedBody.note === undefined) proposedBody.note = existing.note;

    const rawCurrency = proposedBody.currency;
    const submittedCurrency =
      typeof rawCurrency === "string"
        ? rawCurrency.trim().toUpperCase()
        : rawCurrency;
    const preserveStoredFx =
      submittedCurrency === existing.originalCurrency &&
      proposedBody.occurredOn === existing.occurredOn;

    if (preserveStoredFx) {
      proposedBody.currency = existing.originalCurrency;
      proposedBody.exchangeRate = existing.fxRate;
      proposedBody.exchangeRateSource =
        existing.originalCurrency === BASE_CURRENCY ? "identity" : "manual";
      proposedBody.rateDate = null;
    }

    const proposed = await buildNewTransaction(ownerId, proposedBody, db);
    const updatedAtMs = Math.max(Date.now(), existing.updatedAtMs + 1);
    const updatedRows = await db
      .update(transactions)
      .set({
        kind: proposed.kind,
        occurredOn: proposed.occurredOn,
        originalAmountMinor: proposed.originalAmountMinor,
        originalCurrency: proposed.originalCurrency,
        originalCurrencyExponent: proposed.originalCurrencyExponent,
        fxRate: preserveStoredFx ? existing.fxRate : proposed.fxRate,
        fxSource: preserveStoredFx ? existing.fxSource : proposed.fxSource,
        fxRateDate: preserveStoredFx
          ? existing.fxRateDate
          : proposed.fxRateDate,
        fxCapturedAtMs: preserveStoredFx
          ? existing.fxCapturedAtMs
          : proposed.fxCapturedAtMs,
        baseAmountMinor: proposed.baseAmountMinor,
        baseCurrency: proposed.baseCurrency,
        baseCurrencyExponent: proposed.baseCurrencyExponent,
        category: proposed.category,
        subcategory: proposed.subcategory,
        description: proposed.description,
        note: proposed.note,
        updatedAtMs,
      })
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.ownerId, ownerId),
          eq(transactions.updatedAtMs, existing.updatedAtMs),
        ),
      )
      .returning();
    if (!updatedRows[0]) {
      return errorResponse("TRANSACTION_CHANGED", 409, "expectedUpdatedAt");
    }

    return Response.json(
      { data: serializeTransaction(updatedRows[0]) },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return errorResponse(error.code, error.status, error.field);
    }
    console.error("[transactions] PATCH failed", error);
    return errorResponse("INTERNAL_ERROR", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return errorResponse("CROSS_ORIGIN_REQUEST", 403);
    }

    const ownerId = await ownerIdForRequest(request);
    if (!ownerId) return errorResponse("AUTH_REQUIRED", 401);

    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!TRANSACTION_ID_PATTERN.test(id)) {
      return errorResponse("INVALID_TRANSACTION_ID", 400, "id");
    }

    const db = getDb();
    const existingRows = await db
      .select({
        id: transactions.id,
        recurringSeriesId: transactions.recurringSeriesId,
        recurrenceDate: transactions.recurrenceDate,
        splitGroupId: transactions.splitGroupId,
      })
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.ownerId, ownerId)))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) return errorResponse("TRANSACTION_NOT_FOUND", 404);

    let deleted: Array<{ id: string }>;
    if (existing.splitGroupId) {
      deleted = await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.ownerId, ownerId),
            eq(transactions.splitGroupId, existing.splitGroupId),
          ),
        )
        .returning({ id: transactions.id });
    } else if (existing.recurringSeriesId && existing.recurrenceDate) {
      const [, deletedRows] = await db.batch([
        db
          .insert(recurringExceptions)
          .values({
            seriesId: existing.recurringSeriesId,
            occurrenceOn: existing.recurrenceDate,
            ownerId,
            createdAtMs: Date.now(),
          })
          .onConflictDoNothing(),
        db
          .delete(transactions)
          .where(
            and(eq(transactions.id, id), eq(transactions.ownerId, ownerId)),
          )
          .returning({ id: transactions.id }),
      ]);
      deleted = deletedRows;
    } else {
      deleted = await db
        .delete(transactions)
        .where(
          and(eq(transactions.id, id), eq(transactions.ownerId, ownerId)),
        )
        .returning({ id: transactions.id });
    }
    if (!deleted[0]) return errorResponse("TRANSACTION_NOT_FOUND", 404);

    return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[transactions] DELETE failed", error);
    return errorResponse("INTERNAL_ERROR", 500);
  }
}

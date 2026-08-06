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

import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb, type AppDatabase } from "@/db";
import {
  exchangeRateSnapshots,
  transactions,
  userStates,
  type NewTransaction,
  type Transaction,
} from "@/db/schema";

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
const LOCAL_DEMO_OWNER_ID = "local-demo";
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

const SUPPORTED_CURRENCIES = new Set(
  (
    "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF " +
    "BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUC " +
    "CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP " +
    "GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD " +
    "JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL " +
    "LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD " +
    "NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB " +
    "RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL " +
    "THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV " +
    "WST XAF XCD XCG XDR XOF XPF XSU YER ZAR ZMW ZWG ZWL"
  ).split(" "),
);

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

const THREE_DECIMAL_CURRENCIES = new Set([
  "BHD",
  "IQD",
  "JOD",
  "KWD",
  "LYD",
  "OMR",
  "TND",
]);

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

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}

async function ownerIdForRequest(request: Request) {
  const user = await getChatGPTUser();
  if (user?.userId && user.userId.length <= 255) return user.userId;

  const hostname = new URL(request.url).hostname.toLowerCase();
  return isLocalHostname(hostname) ? LOCAL_DEMO_OWNER_ID : null;
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

function currencyExponent(currency: string) {
  if (!SUPPORTED_CURRENCIES.has(currency)) return null;
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(currency)) return 3;
  return 2;
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
    description: transaction.description,
    note: transaction.note,
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

function dateWithinMonth(month: string, daysAgo: number) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentDay =
    month === currentMonth ? new Date().getUTCDate() : 15;
  const day = Math.max(1, currentDay - daysAgo);
  return `${month}-${String(day).padStart(2, "0")}`;
}

function sampleTransaction(
  ownerId: string,
  input: {
    kind: "expense" | "income";
    occurredOn: string;
    amount: string;
    currency: string;
    exchangeRate: string;
    category: string;
    description: string;
    clientRequestId: string;
  },
  timestamp: number,
): NewTransaction {
  const exponent = currencyExponent(input.currency);
  if (exponent === null) throw new Error("Invalid sample currency");

  const originalMinor = parseAmount(input.amount, exponent);
  const rate = parseRate(input.exchangeRate);
  const baseMinor = toBaseMinor(originalMinor, exponent, rate);
  return {
    id: crypto.randomUUID(),
    ownerId,
    kind: input.kind,
    occurredOn: input.occurredOn,
    originalAmountMinor: Number(originalMinor),
    originalCurrency: input.currency,
    originalCurrencyExponent: exponent,
    fxRate: rate.canonical,
    fxSource: input.currency === BASE_CURRENCY ? "identity" : "sample",
    fxRateDate: null,
    fxCapturedAtMs: timestamp,
    baseAmountMinor: Number(baseMinor),
    baseCurrency: BASE_CURRENCY,
    baseCurrencyExponent: BASE_CURRENCY_EXPONENT,
    category: input.category,
    description: input.description,
    note: "Sample transaction",
    clientRequestId: input.clientRequestId,
    createdAtMs: timestamp,
    updatedAtMs: timestamp,
  };
}

async function seedSamplesOnce(
  db: AppDatabase,
  ownerId: string,
  month: string,
) {
  await ensureUserState(db, ownerId);

  const [states, existingTransactions] = await db.batch([
    db
      .select({ samplesSeededAtMs: userStates.samplesSeededAtMs })
      .from(userStates)
      .where(eq(userStates.ownerId, ownerId))
      .limit(1),
    db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.ownerId, ownerId))
      .limit(1),
  ]);

  if (states[0]?.samplesSeededAtMs != null) return;

  const now = Date.now();
  if (existingTransactions.length > 0) {
    await db
      .update(userStates)
      .set({ samplesSeededAtMs: now })
      .where(
        and(
          eq(userStates.ownerId, ownerId),
          isNull(userStates.samplesSeededAtMs),
        ),
      );
    return;
  }

  const samples = [
    sampleTransaction(
      ownerId,
      {
        kind: "expense",
        occurredOn: dateWithinMonth(month, 0),
        amount: "1450",
        currency: "KRW",
        exchangeRate: "0.00072",
        category: "transport",
        description: "Seoul subway",
        clientRequestId: "sample-v1-subway",
      },
      now - 60_000,
    ),
    sampleTransaction(
      ownerId,
      {
        kind: "expense",
        occurredOn: dateWithinMonth(month, 2),
        amount: "4.80",
        currency: "EUR",
        exchangeRate: "1.085",
        category: "dining",
        description: "Coffee with a friend",
        clientRequestId: "sample-v1-coffee",
      },
      now - 120_000,
    ),
    sampleTransaction(
      ownerId,
      {
        kind: "expense",
        occurredOn: dateWithinMonth(month, 5),
        amount: "86.42",
        currency: "USD",
        exchangeRate: "1",
        category: "groceries",
        description: "Neighborhood market",
        clientRequestId: "sample-v1-market",
      },
      now - 180_000,
    ),
    sampleTransaction(
      ownerId,
      {
        kind: "income",
        occurredOn: dateWithinMonth(month, 9),
        amount: "1250.00",
        currency: "EUR",
        exchangeRate: "1.085",
        category: "income",
        description: "Freelance payout",
        clientRequestId: "sample-v1-income",
      },
      now - 240_000,
    ),
  ] as const;

  await db.batch([
    db.insert(transactions).values(samples[0]).onConflictDoNothing(),
    db.insert(transactions).values(samples[1]).onConflictDoNothing(),
    db.insert(transactions).values(samples[2]).onConflictDoNothing(),
    db.insert(transactions).values(samples[3]).onConflictDoNothing(),
    db
      .update(userStates)
      .set({ samplesSeededAtMs: now })
      .where(
        and(
          eq(userStates.ownerId, ownerId),
          isNull(userStates.samplesSeededAtMs),
        ),
      ),
  ]);
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
    fallback: "other",
  });
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
    description,
    note,
    clientRequestId,
    createdAtMs: now,
    updatedAtMs: now,
  };
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

    await seedSamplesOnce(db, ownerId, monthRange.month);

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
    await ensureUserState(db, ownerId);

    if (newTransaction.clientRequestId) {
      const inserted = await db
        .insert(transactions)
        .values(newTransaction)
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) {
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
      if (existing[0] && sameMutation(existing[0], newTransaction)) {
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

export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return errorResponse("CROSS_ORIGIN_REQUEST", 403);
    }

    const ownerId = await ownerIdForRequest(request);
    if (!ownerId) return errorResponse("AUTH_REQUIRED", 401);

    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        id,
      )
    ) {
      return errorResponse("INVALID_TRANSACTION_ID", 400, "id");
    }

    const deleted = await getDb()
      .delete(transactions)
      .where(
        and(eq(transactions.id, id), eq(transactions.ownerId, ownerId)),
      )
      .returning({ id: transactions.id });
    if (!deleted[0]) return errorResponse("TRANSACTION_NOT_FOUND", 404);

    return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[transactions] DELETE failed", error);
    return errorResponse("INTERNAL_ERROR", 500);
  }
}

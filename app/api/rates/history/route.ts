import { isCurrencyCode } from "@/lib/currency";

export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 62;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_LENGTH = 131_072;
const RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };

type ProviderRate = {
  date?: unknown;
  base?: unknown;
  quote?: unknown;
  rate?: unknown;
};

function parseDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.valueOf() - from.valueOf()) / 86_400_000);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(date: Date, days: number) {
  return new Date(date.valueOf() + days * 86_400_000);
}

function usdPerUnit(rate: number) {
  const inverse = 1 / rate;
  if (!Number.isFinite(inverse) || inverse <= 0) throw new Error("INVALID_RATE");
  return inverse.toFixed(12).replace(/\.?0+$/u, "");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const quote = (url.searchParams.get("quote") ?? "").toUpperCase();
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  if (
    !isCurrencyCode(quote) ||
    !from ||
    !to ||
    from > to ||
    daysBetween(from, to) > MAX_RANGE_DAYS
  ) {
    return Response.json(
      { error: { code: "INVALID_HISTORY_RANGE" } },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  if (quote === "USD") {
    const rates: Record<string, string> = {};
    for (let cursor = from; cursor <= to; cursor = shiftDate(cursor, 1)) {
      rates[isoDate(cursor)] = "1";
    }
    return Response.json(
      { data: { baseCurrency: "USD", quote, direction: "USD_PER_ORIGINAL", rates } },
      { headers: RESPONSE_HEADERS },
    );
  }

  const endpoint = new URL("https://api.frankfurter.dev/v2/rates");
  endpoint.searchParams.set("base", "USD");
  endpoint.searchParams.set("quotes", quote);
  endpoint.searchParams.set("from", isoDate(shiftDate(from, -7)));
  endpoint.searchParams.set("to", isoDate(to));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const raw = await response.text();
    if (!raw || raw.length > MAX_RESPONSE_LENGTH) throw new Error("INVALID_RESPONSE_SIZE");
    const payload = JSON.parse(raw) as unknown;
    if (!Array.isArray(payload) || payload.length === 0 || payload.length > 100) {
      throw new Error("INVALID_RESPONSE");
    }

    const observations = new Map<string, string>();
    for (const item of payload as ProviderRate[]) {
      if (
        item.base !== "USD" ||
        item.quote !== quote ||
        typeof item.date !== "string" ||
        !parseDate(item.date) ||
        typeof item.rate !== "number" ||
        !Number.isFinite(item.rate) ||
        item.rate <= 0
      ) {
        throw new Error("INVALID_RATE_ROW");
      }
      observations.set(item.date, usdPerUnit(item.rate));
    }

    const rates: Record<string, string> = {};
    let lastRate: string | null = null;
    for (
      let cursor = shiftDate(from, -7);
      cursor <= to;
      cursor = shiftDate(cursor, 1)
    ) {
      const date = isoDate(cursor);
      lastRate = observations.get(date) ?? lastRate;
      if (cursor >= from && lastRate) rates[date] = lastRate;
    }
    if (Object.keys(rates).length !== daysBetween(from, to) + 1) {
      throw new Error("INCOMPLETE_RATE_RANGE");
    }

    return Response.json(
      { data: { baseCurrency: "USD", quote, direction: "USD_PER_ORIGINAL", rates } },
      { headers: RESPONSE_HEADERS },
    );
  } catch (error) {
    console.error("[rates/history] Lookup failed", error);
    return Response.json(
      { error: { code: "HISTORICAL_RATES_UNAVAILABLE" } },
      { status: 503, headers: { ...RESPONSE_HEADERS, "Retry-After": "300" } },
    );
  } finally {
    clearTimeout(timeout);
  }
}

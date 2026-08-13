import { and, asc, eq, gt, gte } from "drizzle-orm";

import { getDb } from "@/db";
import {
  recurringExceptions,
  recurringSeries,
  transactions,
  type RecurringSeries,
} from "@/db/schema";
import { memberFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const MAX_AMOUNT_MINOR = 9_000_000_000_000;

type JsonRecord = Record<string, unknown>;
type Frequency = "weekly" | "monthly" | "yearly";

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

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return date.toISOString().slice(0, 10) === value;
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorResponse(code: string, status: number, field?: string) {
  return Response.json(
    { error: { code, ...(field ? { field } : {}) } },
    { status, headers: NO_STORE_HEADERS },
  );
}

async function readBody(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) return null;
  const raw = await request.text();
  if (!raw || raw.length > 8_192) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function shiftDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function dateInMonth(month: string, preferredDay: number) {
  return `${month}-${String(Math.min(preferredDay, daysInMonth(month))).padStart(2, "0")}`;
}

function monthOffset(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return shifted.toISOString().slice(0, 7);
}

function candidatesForMonth(
  series: RecurringSeries,
  month: string,
): string[] {
  const monthStart = `${month}-01`;
  const monthEnd = `${monthOffset(month, 1)}-01`;
  const withinSchedule = (date: string) =>
    date >= series.startOn &&
    date < monthEnd &&
    (series.endsOn === null || date <= series.endsOn);

  if (series.frequency === "weekly") {
    const startMs = Date.parse(`${series.startOn}T00:00:00Z`);
    const monthMs = Date.parse(`${monthStart}T00:00:00Z`);
    const weeks = Math.max(
      0,
      Math.ceil((monthMs - startMs) / (7 * 86_400_000)),
    );
    const result: string[] = [];
    for (
      let date = shiftDate(series.startOn, weeks * 7);
      date < monthEnd;
      date = shiftDate(date, 7)
    ) {
      if (date >= monthStart && withinSchedule(date)) result.push(date);
    }
    return result;
  }

  if (month < series.startOn.slice(0, 7)) return [];
  if (series.frequency === "yearly" && month.slice(5) !== series.startOn.slice(5, 7)) {
    return [];
  }
  const date = dateInMonth(month, Number(series.startOn.slice(8)));
  return withinSchedule(date) ? [date] : [];
}

function nextOccurrence(
  series: RecurringSeries,
  today: string,
  exceptions: Set<string>,
) {
  if (series.pausedAtMs !== null || (series.endsOn && series.endsOn < today)) {
    return null;
  }
  for (let offset = 0; offset < 240; offset += 1) {
    const month = monthOffset(today.slice(0, 7), offset);
    for (const candidate of candidatesForMonth(series, month)) {
      if (candidate >= today && !exceptions.has(`${series.id}:${candidate}`)) {
        return candidate;
      }
    }
  }
  return null;
}

function formatMinor(value: number, exponent: number) {
  const digits = String(value).padStart(exponent + 1, "0");
  if (exponent === 0) return digits;
  return `${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

function parseAmountMinor(value: unknown, exponent: number) {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/u.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > exponent) return null;
  const minor = Number(`${whole}${fraction.padEnd(exponent, "0")}`);
  return Number.isSafeInteger(minor) && minor > 0 && minor <= MAX_AMOUNT_MINOR
    ? minor
    : null;
}

function serializeSeries(
  series: RecurringSeries,
  today: string,
  month: string,
  exceptions: Set<string>,
) {
  const status =
    series.pausedAtMs !== null
      ? "paused"
      : series.endsOn && series.endsOn < today
        ? "ended"
        : "active";
  const occurrenceCount =
    status === "active"
      ? candidatesForMonth(series, month).filter(
          (date) => !exceptions.has(`${series.id}:${date}`),
        ).length
      : 0;
  const amountMajor =
    series.originalAmountMinor / 10 ** series.originalCurrencyExponent;
  const estimatedBaseAmountMinor = Math.round(
    amountMajor * Number(series.fallbackFxRate) * 100 * occurrenceCount,
  );

  return {
    id: series.id,
    kind: series.kind,
    description: series.description,
    category: series.category,
    note: series.note,
    amount: formatMinor(
      series.originalAmountMinor,
      series.originalCurrencyExponent,
    ),
    originalAmountMinor: series.originalAmountMinor,
    originalCurrency: series.originalCurrency,
    originalCurrencyExponent: series.originalCurrencyExponent,
    frequency: series.frequency,
    startOn: series.startOn,
    endsOn: series.endsOn,
    status,
    nextOccurrence: nextOccurrence(series, today, exceptions),
    estimatedBaseAmountMinor,
    occurrenceCount,
    updatedAt: new Date(series.updatedAtMs).toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const ownerId = await ownerIdForRequest(request);
    if (!ownerId) return errorResponse("AUTH_REQUIRED", 401);
    const url = new URL(request.url);
    const today = url.searchParams.get("today") ?? new Date().toISOString().slice(0, 10);
    const month = url.searchParams.get("month") ?? today.slice(0, 7);
    if (!isIsoDate(today) || !/^\d{4}-(0[1-9]|1[0-2])$/u.test(month)) {
      return errorResponse("INVALID_DATE_RANGE", 400);
    }

    const db = getDb();
    const [seriesRows, exceptionRows] = await db.batch([
      db
        .select()
        .from(recurringSeries)
        .where(eq(recurringSeries.ownerId, ownerId))
        .orderBy(asc(recurringSeries.description), asc(recurringSeries.id)),
      db
        .select({
          seriesId: recurringExceptions.seriesId,
          occurrenceOn: recurringExceptions.occurrenceOn,
        })
        .from(recurringExceptions)
        .where(
          and(
            eq(recurringExceptions.ownerId, ownerId),
            gte(recurringExceptions.occurrenceOn, `${month}-01`),
          ),
        ),
    ]);
    const exceptions = new Set(
      exceptionRows.map((row) => `${row.seriesId}:${row.occurrenceOn}`),
    );
    const data = seriesRows.map((series) =>
      serializeSeries(series, today, month, exceptions),
    );
    return Response.json(
      {
        data,
        summary: {
          month,
          active: data.filter((item) => item.status === "active").length,
          paused: data.filter((item) => item.status === "paused").length,
          expectedIncomeMinor: data
            .filter((item) => item.kind === "income")
            .reduce((sum, item) => sum + item.estimatedBaseAmountMinor, 0),
          expectedExpenseMinor: data
            .filter((item) => item.kind === "expense")
            .reduce((sum, item) => sum + item.estimatedBaseAmountMinor, 0),
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[recurring] GET failed", error);
    return errorResponse("INTERNAL_ERROR", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) return errorResponse("CROSS_ORIGIN_REQUEST", 403);
    const ownerId = await ownerIdForRequest(request);
    if (!ownerId) return errorResponse("AUTH_REQUIRED", 401);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!ID_PATTERN.test(id)) return errorResponse("INVALID_SERIES_ID", 400);
    const body = await readBody(request);
    if (!body) return errorResponse("INVALID_BODY", 400);

    const db = getDb();
    const rows = await db
      .select()
      .from(recurringSeries)
      .where(and(eq(recurringSeries.id, id), eq(recurringSeries.ownerId, ownerId)))
      .limit(1);
    const series = rows[0];
    if (!series) return errorResponse("SERIES_NOT_FOUND", 404);
    const action = typeof body.action === "string" ? body.action : "stop";
    const now = Math.max(Date.now(), series.updatedAtMs + 1);

    if (action === "pause" || action === "resume") {
      const today = new Date().toISOString().slice(0, 10);
      const updateQuery = db
        .update(recurringSeries)
        .set({ pausedAtMs: action === "pause" ? now : null, updatedAtMs: now })
        .where(
          and(eq(recurringSeries.id, id), eq(recurringSeries.ownerId, ownerId)),
        )
        .returning();
      const updated =
        action === "pause"
          ? (
              await db.batch([
                updateQuery,
                db
                  .delete(transactions)
                  .where(
                    and(
                      eq(transactions.ownerId, ownerId),
                      eq(transactions.recurringSeriesId, id),
                      gt(transactions.recurrenceDate, today),
                    ),
                  ),
              ])
            )[0]
          : await updateQuery;
      return Response.json(
        {
          data: serializeSeries(
            updated[0],
            today,
            today.slice(0, 7),
            new Set(),
          ),
        },
        { headers: NO_STORE_HEADERS },
      );
    }

    if (action === "update") {
      const frequency = body.frequency;
      if (frequency !== "weekly" && frequency !== "monthly" && frequency !== "yearly") {
        return errorResponse("INVALID_RECURRENCE_FREQUENCY", 400, "frequency");
      }
      const endsOn = body.endsOn === null || body.endsOn === "" ? null : body.endsOn;
      if (endsOn !== null && (!isIsoDate(endsOn) || endsOn < series.startOn)) {
        return errorResponse("INVALID_RECURRENCE_END_DATE", 400, "endsOn");
      }
      const amountMinor = parseAmountMinor(
        body.amount,
        series.originalCurrencyExponent,
      );
      if (amountMinor === null) return errorResponse("INVALID_AMOUNT", 400, "amount");
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const category = typeof body.category === "string" ? body.category.trim() : "";
      const note = typeof body.note === "string" ? body.note.trim() : "";
      if (!description || description.length > 120) {
        return errorResponse("INVALID_DESCRIPTION", 400, "description");
      }
      if (!category || category.length > 40) {
        return errorResponse("INVALID_CATEGORY", 400, "category");
      }
      if (note.length > 500) return errorResponse("INVALID_NOTE", 400, "note");
      const today = new Date().toISOString().slice(0, 10);
      const [updated] = await db.batch([
        db
          .update(recurringSeries)
          .set({
            frequency: frequency as Frequency,
            endsOn,
            originalAmountMinor: amountMinor,
            description,
            category,
            note,
            updatedAtMs: now,
          })
          .where(and(eq(recurringSeries.id, id), eq(recurringSeries.ownerId, ownerId)))
          .returning(),
        db
          .delete(transactions)
          .where(
            and(
              eq(transactions.ownerId, ownerId),
              eq(transactions.recurringSeriesId, id),
              gt(transactions.recurrenceDate, today),
            ),
          ),
      ]);
      return Response.json(
        { data: serializeSeries(updated[0], today, today.slice(0, 7), new Set()) },
        { headers: NO_STORE_HEADERS },
      );
    }

    if (!isIsoDate(body.endsOn) || body.endsOn < series.startOn) {
      return errorResponse("INVALID_RECURRENCE_END_DATE", 400, "endsOn");
    }
    const endsOn = series.endsOn && series.endsOn < body.endsOn ? series.endsOn : body.endsOn;
    const [updated] = await db.batch([
      db
        .update(recurringSeries)
        .set({ endsOn, updatedAtMs: now })
        .where(and(eq(recurringSeries.id, id), eq(recurringSeries.ownerId, ownerId)))
        .returning(),
      db
        .delete(transactions)
        .where(
          and(
            eq(transactions.ownerId, ownerId),
            eq(transactions.recurringSeriesId, id),
            gt(transactions.recurrenceDate, endsOn),
          ),
        ),
    ]);
    return Response.json(
      { data: serializeSeries(updated[0], endsOn, endsOn.slice(0, 7), new Set()) },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[recurring] PATCH failed", error);
    return errorResponse("INTERNAL_ERROR", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) return errorResponse("CROSS_ORIGIN_REQUEST", 403);
    const ownerId = await ownerIdForRequest(request);
    if (!ownerId) return errorResponse("AUTH_REQUIRED", 401);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!ID_PATTERN.test(id)) return errorResponse("INVALID_SERIES_ID", 400);
    const deleted = await getDb()
      .delete(recurringSeries)
      .where(and(eq(recurringSeries.id, id), eq(recurringSeries.ownerId, ownerId)))
      .returning({ id: recurringSeries.id });
    if (!deleted[0]) return errorResponse("SERIES_NOT_FOUND", 404);
    return new Response(null, { status: 204, headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[recurring] DELETE failed", error);
    return errorResponse("INTERNAL_ERROR", 500);
  }
}

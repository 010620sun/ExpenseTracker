import { and, eq, gt } from "drizzle-orm";

import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { recurringSeries, transactions } from "@/db/schema";

export const dynamic = "force-dynamic";

const LOCAL_DEMO_OWNER_ID = "local-demo";
const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

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
  return isLocalHostname(new URL(request.url).hostname.toLowerCase())
    ? LOCAL_DEMO_OWNER_ID
    : null;
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

function errorResponse(code: string, status: number) {
  return Response.json(
    { error: { code } },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return errorResponse("CROSS_ORIGIN_REQUEST", 403);
    }
    const ownerId = await ownerIdForRequest(request);
    if (!ownerId) return errorResponse("AUTH_REQUIRED", 401);

    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!ID_PATTERN.test(id)) return errorResponse("INVALID_SERIES_ID", 400);

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("application/json")) {
      return errorResponse("UNSUPPORTED_MEDIA_TYPE", 415);
    }

    const raw = await request.text();
    if (!raw || raw.length > 2_048) return errorResponse("INVALID_BODY", 400);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return errorResponse("INVALID_BODY", 400);
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return errorResponse("INVALID_BODY", 400);
    }
    const body = parsed as { endsOn?: unknown };
    if (!isIsoDate(body.endsOn)) {
      return errorResponse("INVALID_RECURRENCE_END_DATE", 400);
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(recurringSeries)
      .where(
        and(eq(recurringSeries.id, id), eq(recurringSeries.ownerId, ownerId)),
      )
      .limit(1);
    const series = rows[0];
    if (!series) return errorResponse("SERIES_NOT_FOUND", 404);
    if (body.endsOn < series.startOn) {
      return errorResponse("INVALID_RECURRENCE_END_DATE", 400);
    }

    const endsOn =
      series.endsOn && series.endsOn < body.endsOn
        ? series.endsOn
        : body.endsOn;
    const [updated] = await db.batch([
      db
        .update(recurringSeries)
        .set({
          endsOn,
          updatedAtMs: Math.max(Date.now(), series.updatedAtMs + 1),
        })
        .where(
          and(eq(recurringSeries.id, id), eq(recurringSeries.ownerId, ownerId)),
        )
        .returning({ id: recurringSeries.id, endsOn: recurringSeries.endsOn }),
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
      { data: updated[0] },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[recurring] PATCH failed", error);
    return errorResponse("INTERNAL_ERROR", 500);
  }
}

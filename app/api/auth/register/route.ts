import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { members, userStates } from "@/db/schema";
import {
  authRateLimitKey,
  createSession,
  hashNewPassword,
  isAuthRateLimited,
  normalizeDisplayName,
  normalizeEmail,
  recordAuthFailure,
  validPassword,
} from "@/lib/auth";

import {
  authError,
  isSameOrigin,
  NO_STORE_HEADERS,
  readAuthBody,
} from "../shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return authError("CROSS_ORIGIN_REQUEST", 403);
    const body = await readAuthBody(request);
    if (!body) return authError("INVALID_BODY", 400);
    const email = normalizeEmail(body.email);
    const displayName = normalizeDisplayName(body.displayName);
    if (!email) return authError("INVALID_EMAIL", 400, "email");
    if (!displayName) return authError("INVALID_DISPLAY_NAME", 400, "displayName");
    if (!validPassword(body.password)) {
      return authError("WEAK_PASSWORD", 400, "password");
    }
    const rateKey = await authRateLimitKey(request, email);
    if (await isAuthRateLimited(rateKey)) return authError("TOO_MANY_ATTEMPTS", 429);
    const db = getDb();
    const existing = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.email, email))
      .limit(1);
    if (existing[0]) {
      await recordAuthFailure(rateKey);
      return authError("EMAIL_ALREADY_REGISTERED", 409, "email");
    }
    const id = crypto.randomUUID();
    const now = Date.now();
    const password = await hashNewPassword(body.password);
    await db.batch([
      db.insert(members).values({
        id,
        email,
        displayName,
        ...password,
        createdAtMs: now,
        updatedAtMs: now,
      }),
      db.insert(userStates).values({ ownerId: id, createdAtMs: now }),
    ]);
    const cookie = await createSession(id, request.url);
    return Response.json(
      { data: { id, email, displayName } },
      {
        status: 201,
        headers: { ...NO_STORE_HEADERS, "Set-Cookie": cookie },
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /UNIQUE constraint failed: members\.email|uq_members_email/iu.test(
        error.message,
      )
    ) {
      return authError("EMAIL_ALREADY_REGISTERED", 409, "email");
    }
    console.error("[auth] register failed", error);
    return authError("INTERNAL_ERROR", 500);
  }
}

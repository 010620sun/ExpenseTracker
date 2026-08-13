import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { members } from "@/db/schema";
import {
  authRateLimitKey,
  clearAuthFailures,
  createSession,
  isAuthRateLimited,
  normalizeEmail,
  recordAuthFailure,
  validPassword,
  verifyPasswordOrDummy,
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
    if (!email || !validPassword(body.password)) {
      return authError("INVALID_CREDENTIALS", 401);
    }
    const rateKey = await authRateLimitKey(request, email);
    if (await isAuthRateLimited(rateKey)) return authError("TOO_MANY_ATTEMPTS", 429);
    const rows = await getDb()
      .select()
      .from(members)
      .where(eq(members.email, email))
      .limit(1);
    const member = rows[0];
    const valid = await verifyPasswordOrDummy(body.password, member);
    if (!member || !valid) {
      await recordAuthFailure(rateKey);
      return authError("INVALID_CREDENTIALS", 401);
    }
    await clearAuthFailures(rateKey);
    const cookie = await createSession(member.id, request.url);
    return Response.json(
      {
        data: {
          id: member.id,
          email: member.email,
          displayName: member.displayName,
        },
      },
      { headers: { ...NO_STORE_HEADERS, "Set-Cookie": cookie } },
    );
  } catch (error) {
    console.error("[auth] login failed", error);
    return authError("INTERNAL_ERROR", 500);
  }
}

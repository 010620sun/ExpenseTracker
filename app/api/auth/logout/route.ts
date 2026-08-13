import { deleteSession, expiredSessionCookies } from "@/lib/auth";

import { authError, isSameOrigin, NO_STORE_HEADERS } from "../shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return authError("CROSS_ORIGIN_REQUEST", 403);
    await deleteSession(request.headers.get("cookie"));
    const headers = new Headers(NO_STORE_HEADERS);
    for (const cookie of expiredSessionCookies(request.url)) {
      headers.append("Set-Cookie", cookie);
    }
    return new Response(null, { status: 204, headers });
  } catch (error) {
    console.error("[auth] logout failed", error);
    return authError("INTERNAL_ERROR", 500);
  }
}

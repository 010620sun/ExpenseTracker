import { memberFromRequest } from "@/lib/auth";

import { authError, NO_STORE_HEADERS } from "../shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return authError("AUTH_REQUIRED", 401);
  return Response.json({ data: member }, { headers: NO_STORE_HEADERS });
}

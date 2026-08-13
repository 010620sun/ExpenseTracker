import { headers } from "next/headers";

import { memberFromCookieHeader } from "@/lib/auth";

export async function getCurrentMember() {
  const requestHeaders = await headers();
  return memberFromCookieHeader(requestHeaders.get("cookie"));
}

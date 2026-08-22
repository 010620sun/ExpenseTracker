import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/page-metadata";
import { requestLanguage } from "@/lib/request-language";

import { getCurrentMember } from "../member-auth";
import { AuthScreen } from "./auth-screen";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return pageMetadata("auth", await requestLanguage());
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.return_to);
  const [member, initialLanguage] = await Promise.all([
    getCurrentMember(),
    requestLanguage(),
  ]);
  if (member) redirect(returnTo);
  return <AuthScreen initialLanguage={initialLanguage} returnTo={returnTo} />;
}

function safeReturnTo(value: string | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://globeledger.local");
    if (parsed.origin !== "https://globeledger.local") return "/";
    if (parsed.pathname === "/auth" || parsed.pathname.startsWith("/api/")) {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

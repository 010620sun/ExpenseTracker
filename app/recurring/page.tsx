import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/page-metadata";
import { requestLanguage } from "@/lib/request-language";

import { getCurrentMember } from "../member-auth";
import { RecurringManager } from "./recurring-manager";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return pageMetadata("recurring", await requestLanguage());
}

export default async function RecurringPage() {
  const [member, initialLanguage] = await Promise.all([
    getCurrentMember(),
    requestLanguage(),
  ]);
  if (!member) redirect("/auth?return_to=/recurring");

  return (
    <RecurringManager
      initialLanguage={initialLanguage}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}

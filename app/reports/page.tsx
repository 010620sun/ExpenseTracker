import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/page-metadata";
import { requestLanguage } from "@/lib/request-language";

import { getCurrentMember } from "../member-auth";
import { ReportManager } from "./report-manager";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return pageMetadata("reports", await requestLanguage());
}

export default async function ReportsPage() {
  const [member, initialLanguage] = await Promise.all([
    getCurrentMember(),
    requestLanguage(),
  ]);
  if (!member) redirect("/auth?return_to=/reports");

  return <ReportManager initialLanguage={initialLanguage} today={new Date().toISOString().slice(0, 10)} />;
}

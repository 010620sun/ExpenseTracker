import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/page-metadata";
import { requestLanguage } from "@/lib/request-language";

import { getCurrentMember } from "../member-auth";
import { BudgetManager } from "./budget-manager";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return pageMetadata("budgets", await requestLanguage());
}

export default async function BudgetsPage() {
  const [member, initialLanguage] = await Promise.all([
    getCurrentMember(),
    requestLanguage(),
  ]);
  if (!member) redirect("/auth?return_to=/budgets");

  return (
    <BudgetManager
      initialLanguage={initialLanguage}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}

import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/page-metadata";
import { requestLanguage } from "@/lib/request-language";

import { ExpenseTracker } from "../expense-tracker";
import { getCurrentMember } from "../member-auth";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return pageMetadata("transactions", await requestLanguage());
}

export default async function TransactionsPage() {
  const [member, initialLanguage] = await Promise.all([
    getCurrentMember(),
    requestLanguage(),
  ]);
  if (!member) redirect("/auth?return_to=/transactions");

  return (
    <ExpenseTracker
      firstName={member.displayName.trim().split(/\s+/)[0] ?? member.email}
      initialLanguage={initialLanguage}
      today={new Date().toISOString().slice(0, 10)}
      view="transactions"
    />
  );
}

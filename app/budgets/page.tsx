import { redirect } from "next/navigation";

import { getCurrentMember } from "../member-auth";
import { BudgetManager } from "./budget-manager";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/auth?return_to=/budgets");

  return (
    <BudgetManager
      firstName={member.displayName.trim().split(/\s+/)[0] ?? member.email}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}

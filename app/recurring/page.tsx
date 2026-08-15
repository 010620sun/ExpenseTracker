import { redirect } from "next/navigation";

import { getCurrentMember } from "../member-auth";
import { RecurringManager } from "./recurring-manager";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/auth?return_to=/recurring");

  return (
    <RecurringManager
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}

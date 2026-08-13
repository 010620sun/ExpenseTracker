import { redirect } from "next/navigation";

import { ExpenseTracker } from "./expense-tracker";
import { getCurrentMember } from "./member-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const member = await getCurrentMember();
  if (!member) redirect("/auth?return_to=/");

  return (
    <ExpenseTracker
      firstName={member.displayName.trim().split(/\s+/)[0] ?? member.email}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}

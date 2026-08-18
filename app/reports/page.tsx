import { redirect } from "next/navigation";

import { getCurrentMember } from "../member-auth";
import { ReportManager } from "./report-manager";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/auth?return_to=/reports");

  return <ReportManager today={new Date().toISOString().slice(0, 10)} />;
}

import { getChatGPTUser } from "../chatgpt-auth";
import { RecurringManager } from "./recurring-manager";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const user = await getChatGPTUser();
  return (
    <RecurringManager
      firstName={user?.fullName?.trim().split(/\s+/)[0] ?? null}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}

import { getChatGPTUser } from "./chatgpt-auth";
import { ExpenseTracker } from "./expense-tracker";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const firstName = user?.fullName?.trim().split(/\s+/)[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);

  return <ExpenseTracker firstName={firstName} today={today} />;
}

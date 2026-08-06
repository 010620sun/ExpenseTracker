import { getChatGPTUser } from "./chatgpt-auth";
import { ExpenseTracker } from "./expense-tracker";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const firstName = user?.fullName?.trim().split(/\s+/)[0] ?? null;

  return <ExpenseTracker firstName={firstName} />;
}

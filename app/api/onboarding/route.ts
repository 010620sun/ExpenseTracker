import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { monthlyBudgets, transactions, userStates } from "@/db/schema";
import { memberFromRequest } from "@/lib/auth";

import { authError, NO_STORE_HEADERS } from "../auth/shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const member = await memberFromRequest(request);
    if (!member) return authError("AUTH_REQUIRED", 401);

    const db = getDb();
    await db
      .insert(userStates)
      .values({ ownerId: member.id, createdAtMs: Date.now() })
      .onConflictDoNothing();

    const [stateRows, transactionRows, budgetRows] = await db.batch([
      db
        .select({
          baseCurrency: userStates.baseCurrency,
          configuredAtMs: userStates.baseCurrencyConfiguredAtMs,
        })
        .from(userStates)
        .where(eq(userStates.ownerId, member.id))
        .limit(1),
      db
        .select({ present: sql<number>`1` })
        .from(transactions)
        .where(eq(transactions.ownerId, member.id))
        .limit(1),
      db
        .select({ present: sql<number>`1` })
        .from(monthlyBudgets)
        .where(eq(monthlyBudgets.ownerId, member.id))
        .limit(1),
    ]);

    const baseCurrencyConfigured = stateRows[0]?.configuredAtMs != null;
    const hasTransaction = transactionRows.length > 0;
    const hasBudget = budgetRows.length > 0;
    const completedCount = [
      baseCurrencyConfigured,
      hasTransaction,
      hasBudget,
    ].filter(Boolean).length;

    return Response.json(
      {
        data: {
          baseCurrency: stateRows[0]?.baseCurrency ?? "USD",
          baseCurrencyConfigured,
          hasTransaction,
          hasBudget,
          completedCount,
          completed: completedCount === 3,
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[onboarding] GET failed", error);
    return authError("INTERNAL_ERROR", 500);
  }
}

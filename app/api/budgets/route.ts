import { and, eq, gte, lt, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { monthlyBudgets, transactions, userStates } from "@/db/schema";
import { memberFromRequest } from "@/lib/auth";
import {
  EXPENSE_CATEGORY_IDS,
  type ExpenseCategoryId,
} from "@/lib/categories";

import {
  authError,
  isSameOrigin,
  NO_STORE_HEADERS,
  readAuthBody,
} from "../auth/shared";

export const dynamic = "force-dynamic";

const MAX_AMOUNT_USD_MINOR = 9_000_000_000_000;
// Six parameters are bound per budget row; 16 rows stay below D1's limit of
// 100 parameters per statement.
const D1_BUDGET_INSERT_CHUNK_SIZE = 16;
type BudgetCategory = ExpenseCategoryId;
const BUDGET_CATEGORY_SET = new Set<string>(EXPENSE_CATEGORY_IDS);

function isMonth(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/u.exec(value);
  return Boolean(match && Number(match[1]) >= 1900 && Number(match[1]) <= 9998);
}

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return next.toISOString().slice(0, 7);
}

async function ownerIdForRequest(request: Request) {
  return (await memberFromRequest(request))?.id ?? null;
}

export async function GET(request: Request) {
  try {
    const ownerId = await ownerIdForRequest(request);
    if (!ownerId) return authError("AUTH_REQUIRED", 401);
    const month = new URL(request.url).searchParams.get("month");
    if (!isMonth(month)) return authError("INVALID_MONTH", 400, "month");

    const db = getDb();
    const [budgetRows, spendingRows] = await db.batch([
      db
        .select({
          category: monthlyBudgets.category,
          amountUsdMinor: monthlyBudgets.amountUsdMinor,
        })
        .from(monthlyBudgets)
        .where(
          and(
            eq(monthlyBudgets.ownerId, ownerId),
            eq(monthlyBudgets.month, month),
          ),
        ),
      db
        .select({
          category: transactions.category,
          spentUsdMinor: sql<number>`coalesce(sum(${transactions.baseAmountMinor}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.ownerId, ownerId),
            eq(transactions.kind, "expense"),
            gte(transactions.occurredOn, `${month}-01`),
            lt(transactions.occurredOn, `${nextMonth(month)}-01`),
          ),
        )
        .groupBy(transactions.category),
    ]);

    const totalBudgetUsdMinor = budgetRows.reduce(
      (total, row) => total + row.amountUsdMinor,
      0,
    );
    const totalSpentUsdMinor = spendingRows.reduce(
      (total, row) => total + Number(row.spentUsdMinor),
      0,
    );

    return Response.json(
      {
        data: {
          month,
          budgets: budgetRows,
          spending: spendingRows,
          totalBudgetUsdMinor,
          totalSpentUsdMinor,
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[budgets] GET failed", error);
    return authError("INTERNAL_ERROR", 500);
  }
}

export async function PUT(request: Request) {
  try {
    if (!isSameOrigin(request)) return authError("CROSS_ORIGIN_REQUEST", 403);
    const ownerId = await ownerIdForRequest(request);
    if (!ownerId) return authError("AUTH_REQUIRED", 401);
    const body = await readAuthBody(request);
    if (!body || !isMonth(body.month) || !Array.isArray(body.budgets)) {
      return authError("INVALID_BODY", 400);
    }
    if (body.budgets.length > EXPENSE_CATEGORY_IDS.length) {
      return authError("TOO_MANY_BUDGETS", 400, "budgets");
    }

    const seen = new Set<string>();
    const values: Array<{
      ownerId: string;
      month: string;
      category: BudgetCategory;
      amountUsdMinor: number;
      createdAtMs: number;
      updatedAtMs: number;
    }> = [];
    const now = Date.now();
    for (const item of body.budgets) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return authError("INVALID_BUDGET", 400, "budgets");
      }
      const category = (item as Record<string, unknown>).category;
      const amountUsdMinor = (item as Record<string, unknown>).amountUsdMinor;
      if (
        typeof category !== "string" ||
        !BUDGET_CATEGORY_SET.has(category) ||
        seen.has(category) ||
        typeof amountUsdMinor !== "number" ||
        !Number.isSafeInteger(amountUsdMinor) ||
        amountUsdMinor <= 0 ||
        amountUsdMinor > MAX_AMOUNT_USD_MINOR
      ) {
        return authError("INVALID_BUDGET", 400, "budgets");
      }
      seen.add(category);
      values.push({
        ownerId,
        month: body.month,
        category: category as BudgetCategory,
        amountUsdMinor,
        createdAtMs: now,
        updatedAtMs: now,
      });
    }

    const db = getDb();
    await db
      .insert(userStates)
      .values({ ownerId, createdAtMs: Date.now() })
      .onConflictDoNothing();
    const clearMonth = db.delete(monthlyBudgets).where(
      and(
        eq(monthlyBudgets.ownerId, ownerId),
        eq(monthlyBudgets.month, body.month),
      ),
    );
    if (values.length > 0) {
      const inserts = [];
      for (
        let index = 0;
        index < values.length;
        index += D1_BUDGET_INSERT_CHUNK_SIZE
      ) {
        inserts.push(
          db
            .insert(monthlyBudgets)
            .values(values.slice(index, index + D1_BUDGET_INSERT_CHUNK_SIZE)),
        );
      }
      await db.batch([clearMonth, ...inserts]);
    } else {
      await clearMonth;
    }

    return Response.json(
      {
        data: {
          month: body.month,
          budgets: values.map(({ category, amountUsdMinor }) => ({
            category,
            amountUsdMinor,
          })),
          totalBudgetUsdMinor: values.reduce(
            (total, row) => total + row.amountUsdMinor,
            0,
          ),
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[budgets] PUT failed", error);
    return authError("INTERNAL_ERROR", 500);
  }
}

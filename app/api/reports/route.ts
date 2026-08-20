import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

import { getDb, type AppDatabase } from "@/db";
import { transactions } from "@/db/schema";
import { memberFromRequest } from "@/lib/auth";

import { authError, NO_STORE_HEADERS } from "../auth/shared";

export const dynamic = "force-dynamic";

function isMonth(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/u.exec(value);
  return Boolean(match && Number(match[1]) >= 1900 && Number(match[1]) <= 9998);
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1))
    .toISOString()
    .slice(0, 7);
}

function summaryQuery(db: AppDatabase, ownerId: string, start: string, end: string) {
  return db
    .select({
      incomeUsdMinor: sql<number>`coalesce(sum(case when ${transactions.kind} = 'income' then ${transactions.baseAmountMinor} else 0 end), 0)`,
      expenseUsdMinor: sql<number>`coalesce(sum(case when ${transactions.kind} = 'expense' then ${transactions.baseAmountMinor} else 0 end), 0)`,
      incomeCount: sql<number>`sum(case when ${transactions.kind} = 'income' then 1 else 0 end)`,
      expenseCount: sql<number>`sum(case when ${transactions.kind} = 'expense' then 1 else 0 end)`,
      transactionCount: sql<number>`count(*)`,
      activeDays: sql<number>`count(distinct ${transactions.occurredOn})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.ownerId, ownerId),
        gte(transactions.occurredOn, start),
        lt(transactions.occurredOn, end),
      ),
    );
}

export async function GET(request: Request) {
  try {
    const member = await memberFromRequest(request);
    if (!member) return authError("AUTH_REQUIRED", 401);

    const month = new URL(request.url).searchParams.get("month");
    if (!isMonth(month)) return authError("INVALID_MONTH", 400, "month");

    const previousMonth = shiftMonth(month, -1);
    const nextMonth = shiftMonth(month, 1);
    const start = `${month}-01`;
    const end = `${nextMonth}-01`;
    const previousStart = `${previousMonth}-01`;
    const db = getDb();

    const [summaryRows, previousSummaryRows, categoryRows, dailyRows, currencyRows, merchantRows, valuationRows] =
      await db.batch([
        summaryQuery(db, member.id, start, end),
        summaryQuery(db, member.id, previousStart, start),
        db
          .select({
            category: transactions.category,
            expenseUsdMinor: sql<number>`sum(${transactions.baseAmountMinor})`,
            transactionCount: sql<number>`count(*)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, member.id),
              eq(transactions.kind, "expense"),
              gte(transactions.occurredOn, start),
              lt(transactions.occurredOn, end),
            ),
          )
          .groupBy(transactions.category)
          .orderBy(desc(sql`sum(${transactions.baseAmountMinor})`)),
        db
          .select({
            occurredOn: transactions.occurredOn,
            incomeUsdMinor: sql<number>`sum(case when ${transactions.kind} = 'income' then ${transactions.baseAmountMinor} else 0 end)`,
            expenseUsdMinor: sql<number>`sum(case when ${transactions.kind} = 'expense' then ${transactions.baseAmountMinor} else 0 end)`,
            transactionCount: sql<number>`count(*)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, member.id),
              gte(transactions.occurredOn, start),
              lt(transactions.occurredOn, end),
            ),
          )
          .groupBy(transactions.occurredOn)
          .orderBy(transactions.occurredOn),
        db
          .select({
            currency: transactions.originalCurrency,
            currencyExponent: transactions.originalCurrencyExponent,
            originalAmountMinor: sql<number>`sum(${transactions.originalAmountMinor})`,
            expenseUsdMinor: sql<number>`sum(${transactions.baseAmountMinor})`,
            transactionCount: sql<number>`count(*)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, member.id),
              eq(transactions.kind, "expense"),
              gte(transactions.occurredOn, start),
              lt(transactions.occurredOn, end),
            ),
          )
          .groupBy(
            transactions.originalCurrency,
            transactions.originalCurrencyExponent,
          )
          .orderBy(desc(sql`sum(${transactions.baseAmountMinor})`)),
        db
          .select({
            description: transactions.description,
            category: transactions.category,
            expenseUsdMinor: sql<number>`sum(${transactions.baseAmountMinor})`,
            transactionCount: sql<number>`count(*)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, member.id),
              eq(transactions.kind, "expense"),
              gte(transactions.occurredOn, start),
              lt(transactions.occurredOn, end),
            ),
          )
          .groupBy(transactions.description, transactions.category)
          .orderBy(desc(sql`sum(${transactions.baseAmountMinor})`))
          .limit(5),
        db
          .select({
            kind: transactions.kind,
            occurredOn: transactions.occurredOn,
            currency: transactions.originalCurrency,
            currencyExponent: transactions.originalCurrencyExponent,
            fxRate: transactions.fxRate,
            category: transactions.category,
            description: transactions.description,
            originalAmountMinor: sql<number>`sum(${transactions.originalAmountMinor})`,
            baseAmountMinor: sql<number>`sum(${transactions.baseAmountMinor})`,
            transactionCount: sql<number>`count(*)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.ownerId, member.id),
              gte(transactions.occurredOn, previousStart),
              lt(transactions.occurredOn, end),
            ),
          )
          .groupBy(
            transactions.kind,
            transactions.occurredOn,
            transactions.originalCurrency,
            transactions.originalCurrencyExponent,
            transactions.fxRate,
            transactions.category,
            transactions.description,
          ),
      ]);

    const normalizeSummary = (row: (typeof summaryRows)[number] | undefined) => {
      const incomeUsdMinor = Number(row?.incomeUsdMinor) || 0;
      const expenseUsdMinor = Number(row?.expenseUsdMinor) || 0;
      return {
        incomeUsdMinor,
        expenseUsdMinor,
        netUsdMinor: incomeUsdMinor - expenseUsdMinor,
        incomeCount: Number(row?.incomeCount) || 0,
        expenseCount: Number(row?.expenseCount) || 0,
        transactionCount: Number(row?.transactionCount) || 0,
        activeDays: Number(row?.activeDays) || 0,
      };
    };

    return Response.json(
      {
        data: {
          month,
          baseCurrency: "USD",
          summary: normalizeSummary(summaryRows[0]),
          previous: {
            month: previousMonth,
            ...normalizeSummary(previousSummaryRows[0]),
          },
          categories: categoryRows.map((row) => ({
            ...row,
            expenseUsdMinor: Number(row.expenseUsdMinor) || 0,
            transactionCount: Number(row.transactionCount) || 0,
          })),
          daily: dailyRows.map((row) => ({
            ...row,
            incomeUsdMinor: Number(row.incomeUsdMinor) || 0,
            expenseUsdMinor: Number(row.expenseUsdMinor) || 0,
            transactionCount: Number(row.transactionCount) || 0,
          })),
          currencies: currencyRows.map((row) => ({
            ...row,
            originalAmountMinor: Number(row.originalAmountMinor) || 0,
            expenseUsdMinor: Number(row.expenseUsdMinor) || 0,
            transactionCount: Number(row.transactionCount) || 0,
          })),
          merchants: merchantRows.map((row) => ({
            ...row,
            expenseUsdMinor: Number(row.expenseUsdMinor) || 0,
            transactionCount: Number(row.transactionCount) || 0,
          })),
          valuationBuckets: valuationRows.map((row) => ({
            ...row,
            originalAmountMinor: Number(row.originalAmountMinor) || 0,
            baseAmountMinor: Number(row.baseAmountMinor) || 0,
            transactionCount: Number(row.transactionCount) || 0,
          })),
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[reports] GET failed", error);
    return authError("INTERNAL_ERROR", 500);
  }
}

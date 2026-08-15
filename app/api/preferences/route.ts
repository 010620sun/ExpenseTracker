import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { userStates } from "@/db/schema";
import { memberFromRequest } from "@/lib/auth";
import { isCurrencyCode } from "@/lib/currency";
import { isLanguage } from "@/lib/language";

import {
  authError,
  isSameOrigin,
  NO_STORE_HEADERS,
  readAuthBody,
} from "../auth/shared";

export const dynamic = "force-dynamic";

async function stateForRequest(request: Request) {
  const member = await memberFromRequest(request);
  if (!member) return null;
  const db = getDb();
  await db
    .insert(userStates)
    .values({ ownerId: member.id, createdAtMs: Date.now() })
    .onConflictDoNothing();
  return { db, ownerId: member.id };
}

export async function GET(request: Request) {
  try {
    const state = await stateForRequest(request);
    if (!state) return authError("AUTH_REQUIRED", 401);
    const rows = await state.db
      .select({
        baseCurrency: userStates.baseCurrency,
        lastTransactionCurrency: userStates.lastTransactionCurrency,
        language: userStates.language,
      })
      .from(userStates)
      .where(eq(userStates.ownerId, state.ownerId))
      .limit(1);
    return Response.json({ data: rows[0] }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[preferences] GET failed", error);
    return authError("INTERNAL_ERROR", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) return authError("CROSS_ORIGIN_REQUEST", 403);
    const state = await stateForRequest(request);
    if (!state) return authError("AUTH_REQUIRED", 401);
    const body = await readAuthBody(request);
    if (!body) return authError("INVALID_BODY", 400);

    const updates: {
      baseCurrency?: string;
      lastTransactionCurrency?: string;
      language?: "en" | "ko" | "ja" | "ru";
    } = {};
    if (body.baseCurrency !== undefined) {
      if (!isCurrencyCode(body.baseCurrency)) {
        return authError("INVALID_CURRENCY", 400, "baseCurrency");
      }
      updates.baseCurrency = body.baseCurrency;
    }
    if (body.lastTransactionCurrency !== undefined) {
      if (!isCurrencyCode(body.lastTransactionCurrency)) {
        return authError(
          "INVALID_CURRENCY",
          400,
          "lastTransactionCurrency",
        );
      }
      updates.lastTransactionCurrency = body.lastTransactionCurrency;
    }
    if (body.language !== undefined) {
      if (!isLanguage(body.language)) {
        return authError("INVALID_LANGUAGE", 400, "language");
      }
      updates.language = body.language;
    }
    if (Object.keys(updates).length === 0) {
      return authError("INVALID_BODY", 400);
    }

    const rows = await state.db
      .update(userStates)
      .set(updates)
      .where(eq(userStates.ownerId, state.ownerId))
      .returning({
        baseCurrency: userStates.baseCurrency,
        lastTransactionCurrency: userStates.lastTransactionCurrency,
        language: userStates.language,
      });
    return Response.json({ data: rows[0] }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[preferences] PATCH failed", error);
    return authError("INTERNAL_ERROR", 500);
  }
}

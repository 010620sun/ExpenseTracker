import { and, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { transactions } from "@/db/schema";
import { memberFromRequest } from "@/lib/auth";
import {
  CATEGORY_VERSION,
  isCategoryForKind,
  isSubcategoryForCategory,
} from "@/lib/categories";
import { isLanguage } from "@/lib/language";
import { classifyTransaction } from "@/lib/transaction-classifier";

import {
  authError,
  isSameOrigin,
  NO_STORE_HEADERS,
  readAuthBody,
} from "../../auth/shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return authError("CROSS_ORIGIN_REQUEST", 403);
    const member = await memberFromRequest(request);
    if (!member) return authError("AUTH_REQUIRED", 401);

    const body = await readAuthBody(request);
    if (!body) return authError("INVALID_BODY", 400);
    if (body.kind !== "expense" && body.kind !== "income") {
      return authError("INVALID_KIND", 400, "kind");
    }
    if (typeof body.description !== "string") {
      return authError("INVALID_DESCRIPTION", 400, "description");
    }
    const description = body.description.normalize("NFC").trim();
    if (!description || description.length > 120) {
      return authError("INVALID_DESCRIPTION", 400, "description");
    }
    if (body.language !== undefined && !isLanguage(body.language)) {
      return authError("INVALID_LANGUAGE", 400, "language");
    }

    const knownRows = await getDb()
      .select({
        category: transactions.category,
        subcategory: transactions.subcategory,
        tags: transactions.tags,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.ownerId, member.id),
          eq(transactions.kind, body.kind),
          sql`lower(trim(${transactions.description})) = lower(${description})`,
        ),
      )
      .orderBy(desc(transactions.occurredOn), desc(transactions.updatedAtMs))
      .limit(1);
    const known = knownRows[0];
    if (
      known &&
      isCategoryForKind(known.category, body.kind) &&
      typeof known.subcategory === "string" &&
      isSubcategoryForCategory(known.category, known.subcategory)
    ) {
      return Response.json(
        {
          data: {
            category: known.category,
            subcategory: known.subcategory,
            tags: known.tags,
            confidence: 100,
            source: "rule",
            version: CATEGORY_VERSION,
          },
        },
        { headers: NO_STORE_HEADERS },
      );
    }

    const classification = await classifyTransaction({
      kind: body.kind,
      description,
      ...(typeof body.language === "string" && isLanguage(body.language)
        ? { language: body.language }
        : {}),
    });
    return Response.json(
      { data: classification },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[transaction-classifier] POST failed", error);
    return authError("INTERNAL_ERROR", 500);
  }
}

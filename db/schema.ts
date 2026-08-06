import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const userStates = sqliteTable(
  "user_states",
  {
    ownerId: text("owner_id").primaryKey(),
    samplesSeededAtMs: integer("samples_seeded_at_ms"),
    createdAtMs: integer("created_at_ms").notNull(),
  },
  (table) => [
    check(
      "user_states_owner_id_length",
      sql`length(${table.ownerId}) BETWEEN 1 AND 255`,
    ),
    check(
      "user_states_created_at_positive",
      sql`${table.createdAtMs} > 0`,
    ),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => userStates.ownerId, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["expense", "income"] }).notNull(),
    occurredOn: text("occurred_on").notNull(),

    // Monetary values use ISO 4217 minor units. The API never persists a
    // JavaScript floating-point amount.
    originalAmountMinor: integer("original_amount_minor").notNull(),
    originalCurrency: text("original_currency").notNull(),
    originalCurrencyExponent: integer(
      "original_currency_exponent",
    ).notNull(),

    // fx_rate is a canonical decimal string in the direction
    // "1 original currency major unit = fx_rate USD major units".
    fxRate: text("fx_rate").notNull(),
    fxSource: text("fx_source", {
      enum: ["identity", "manual", "sample"],
    }).notNull(),
    fxCapturedAtMs: integer("fx_captured_at_ms").notNull(),

    baseAmountMinor: integer("base_amount_minor").notNull(),
    baseCurrency: text("base_currency").notNull().default("USD"),
    baseCurrencyExponent: integer("base_currency_exponent")
      .notNull()
      .default(2),

    category: text("category").notNull().default("other"),
    description: text("description").notNull(),
    note: text("note").notNull().default(""),
    clientRequestId: text("client_request_id"),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    check(
      "transactions_id_length",
      sql`length(${table.id}) BETWEEN 1 AND 64`,
    ),
    check(
      "transactions_kind",
      sql`${table.kind} IN ('expense', 'income')`,
    ),
    check(
      "transactions_occurred_on_shape",
      sql`length(${table.occurredOn}) = 10 AND ${table.occurredOn} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check(
      "transactions_original_amount_range",
      sql`${table.originalAmountMinor} > 0 AND ${table.originalAmountMinor} <= 9000000000000`,
    ),
    check(
      "transactions_base_amount_range",
      sql`${table.baseAmountMinor} >= 0 AND ${table.baseAmountMinor} <= 9000000000000`,
    ),
    check(
      "transactions_original_currency_shape",
      sql`length(${table.originalCurrency}) = 3 AND ${table.originalCurrency} = upper(${table.originalCurrency})`,
    ),
    check(
      "transactions_original_exponent_range",
      sql`${table.originalCurrencyExponent} BETWEEN 0 AND 4`,
    ),
    check(
      "transactions_fx_rate_length",
      sql`length(${table.fxRate}) BETWEEN 1 AND 32`,
    ),
    check(
      "transactions_fx_source",
      sql`${table.fxSource} IN ('identity', 'manual', 'sample')`,
    ),
    check(
      "transactions_timestamps_positive",
      sql`${table.fxCapturedAtMs} > 0 AND ${table.createdAtMs} > 0 AND ${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
    check(
      "transactions_base_currency_usd",
      sql`${table.baseCurrency} = 'USD' AND ${table.baseCurrencyExponent} = 2`,
    ),
    check(
      "transactions_identity_conversion",
      sql`${table.originalCurrency} <> 'USD' OR (${table.fxRate} = '1' AND ${table.originalAmountMinor} = ${table.baseAmountMinor})`,
    ),
    check(
      "transactions_category_length",
      sql`length(${table.category}) BETWEEN 1 AND 40`,
    ),
    check(
      "transactions_description_length",
      sql`length(${table.description}) BETWEEN 1 AND 120`,
    ),
    check(
      "transactions_note_length",
      sql`length(${table.note}) <= 500`,
    ),
    check(
      "transactions_client_request_id_length",
      sql`${table.clientRequestId} IS NULL OR length(${table.clientRequestId}) BETWEEN 1 AND 64`,
    ),
    index("idx_transactions_owner_occurred").on(
      table.ownerId,
      table.occurredOn,
      table.createdAtMs,
      table.id,
    ),
    uniqueIndex("uq_transactions_owner_client_request")
      .on(table.ownerId, table.clientRequestId)
      .where(sql`${table.clientRequestId} IS NOT NULL`),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

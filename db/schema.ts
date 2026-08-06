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

// Shared by every user. Freshness is derived from fetched_at_ms so a cached
// row can remain the last-known-good fallback after its normal TTL expires.
export const exchangeRateCache = sqliteTable(
  "exchange_rate_cache",
  {
    quoteCurrency: text("quote_currency").primaryKey(),
    baseCurrency: text("base_currency").notNull().default("USD"),
    usdPerUnit: text("usd_per_unit").notNull(),
    rateDate: text("rate_date").notNull(),
    fetchedAtMs: integer("fetched_at_ms").notNull(),
    source: text("source", { enum: ["frankfurter"] })
      .notNull()
      .default("frankfurter"),
  },
  (table) => [
    check(
      "exchange_rate_cache_supported_quote",
      sql`${table.quoteCurrency} IN ('KRW', 'EUR', 'JPY', 'GBP', 'SGD', 'CAD', 'AUD')`,
    ),
    check(
      "exchange_rate_cache_base_usd",
      sql`${table.baseCurrency} = 'USD'`,
    ),
    check(
      "exchange_rate_cache_rate_length",
      sql`length(${table.usdPerUnit}) BETWEEN 1 AND 32`,
    ),
    check(
      "exchange_rate_cache_rate_date_shape",
      sql`length(${table.rateDate}) = 10 AND ${table.rateDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check(
      "exchange_rate_cache_fetched_at_positive",
      sql`${table.fetchedAtMs} > 0`,
    ),
    check(
      "exchange_rate_cache_source",
      sql`${table.source} = 'frankfurter'`,
    ),
  ],
);

// Immutable rate/date combinations that have been served to clients. Keeping
// these snapshots lets a transaction remain verifiable after the current cache
// advances to a newer reference date.
export const exchangeRateSnapshots = sqliteTable(
  "exchange_rate_snapshots",
  {
    snapshotId: text("snapshot_id").primaryKey(),
    quoteCurrency: text("quote_currency").notNull(),
    baseCurrency: text("base_currency").notNull().default("USD"),
    usdPerUnit: text("usd_per_unit").notNull(),
    rateDate: text("rate_date").notNull(),
    fetchedAtMs: integer("fetched_at_ms").notNull(),
    source: text("source", { enum: ["frankfurter"] })
      .notNull()
      .default("frankfurter"),
  },
  (table) => [
    check(
      "exchange_rate_snapshots_id",
      sql`length(${table.snapshotId}) BETWEEN 1 AND 64 AND ${table.snapshotId} = ${table.quoteCurrency} || ':' || ${table.rateDate} || ':' || ${table.usdPerUnit}`,
    ),
    check(
      "exchange_rate_snapshots_supported_quote",
      sql`${table.quoteCurrency} IN ('KRW', 'EUR', 'JPY', 'GBP', 'SGD', 'CAD', 'AUD')`,
    ),
    check(
      "exchange_rate_snapshots_base_usd",
      sql`${table.baseCurrency} = 'USD'`,
    ),
    check(
      "exchange_rate_snapshots_rate_length",
      sql`length(${table.usdPerUnit}) BETWEEN 1 AND 32`,
    ),
    check(
      "exchange_rate_snapshots_rate_date_shape",
      sql`length(${table.rateDate}) = 10 AND ${table.rateDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check(
      "exchange_rate_snapshots_fetched_at_positive",
      sql`${table.fetchedAtMs} > 0`,
    ),
    check(
      "exchange_rate_snapshots_source",
      sql`${table.source} = 'frankfurter'`,
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
      enum: ["identity", "manual", "sample", "frankfurter"],
    }).notNull(),
    fxRateDate: text("fx_rate_date"),
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
      sql`${table.fxSource} IN ('identity', 'manual', 'sample', 'frankfurter')`,
    ),
    check(
      "transactions_fx_rate_date_shape",
      sql`${table.fxRateDate} IS NULL OR (length(${table.fxRateDate}) = 10 AND ${table.fxRateDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`,
    ),
    check(
      "transactions_fx_provenance",
      sql`(${table.fxSource} = 'frankfurter' AND ${table.fxRateDate} IS NOT NULL) OR (${table.fxSource} <> 'frankfurter' AND ${table.fxRateDate} IS NULL)`,
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
      sql`(${table.originalCurrency} = 'USD' AND ${table.fxSource} = 'identity' AND ${table.fxRate} = '1' AND ${table.originalAmountMinor} = ${table.baseAmountMinor}) OR (${table.originalCurrency} <> 'USD' AND ${table.fxSource} <> 'identity')`,
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
export type ExchangeRateCache = typeof exchangeRateCache.$inferSelect;
export type ExchangeRateSnapshot = typeof exchangeRateSnapshots.$inferSelect;

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    uniqueIndex("uq_members_email").on(table.email),
    check("members_id_length", sql`length(${table.id}) BETWEEN 1 AND 64`),
    check(
      "members_email_shape",
      sql`length(${table.email}) BETWEEN 3 AND 254 AND ${table.email} = lower(${table.email}) AND instr(${table.email}, '@') > 1`,
    ),
    check(
      "members_display_name_length",
      sql`length(${table.displayName}) BETWEEN 1 AND 80`,
    ),
    check(
      "members_password_material",
      sql`length(${table.passwordHash}) BETWEEN 32 AND 128 AND length(${table.passwordSalt}) BETWEEN 16 AND 64 AND ${table.passwordIterations} BETWEEN 100000 AND 1000000`,
    ),
    check(
      "members_timestamps",
      sql`${table.createdAtMs} > 0 AND ${table.updatedAtMs} >= ${table.createdAtMs}`,
    ),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAtMs: integer("expires_at_ms").notNull(),
    createdAtMs: integer("created_at_ms").notNull(),
    lastSeenAtMs: integer("last_seen_at_ms").notNull(),
  },
  (table) => [
    uniqueIndex("uq_auth_sessions_token_hash").on(table.tokenHash),
    index("idx_auth_sessions_member_expires").on(
      table.memberId,
      table.expiresAtMs,
    ),
    check("auth_sessions_id_length", sql`length(${table.id}) BETWEEN 1 AND 64`),
    check(
      "auth_sessions_token_hash_length",
      sql`length(${table.tokenHash}) BETWEEN 32 AND 128`,
    ),
    check(
      "auth_sessions_timestamps",
      sql`${table.createdAtMs} > 0 AND ${table.lastSeenAtMs} >= ${table.createdAtMs} AND ${table.expiresAtMs} > ${table.createdAtMs}`,
    ),
  ],
);

export const authRateLimits = sqliteTable(
  "auth_rate_limits",
  {
    keyHash: text("key_hash").primaryKey(),
    attempts: integer("attempts").notNull(),
    windowStartedAtMs: integer("window_started_at_ms").notNull(),
    blockedUntilMs: integer("blocked_until_ms"),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    check(
      "auth_rate_limits_key_hash_length",
      sql`length(${table.keyHash}) BETWEEN 32 AND 128`,
    ),
    check(
      "auth_rate_limits_attempts",
      sql`${table.attempts} BETWEEN 0 AND 100`,
    ),
    check(
      "auth_rate_limits_timestamps",
      sql`${table.windowStartedAtMs} > 0 AND ${table.updatedAtMs} >= ${table.windowStartedAtMs} AND (${table.blockedUntilMs} IS NULL OR ${table.blockedUntilMs} > ${table.windowStartedAtMs})`,
    ),
  ],
);

export const userStates = sqliteTable(
  "user_states",
  {
    ownerId: text("owner_id").primaryKey(),
    samplesSeededAtMs: integer("samples_seeded_at_ms"),
    baseCurrency: text("base_currency").notNull().default("USD"),
    lastTransactionCurrency: text("last_transaction_currency")
      .notNull()
      .default("KRW"),
    language: text("language", { enum: ["en", "ko", "ja", "ru"] })
      .notNull()
      .default("en"),
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
    check(
      "user_states_base_currency_shape",
      sql`length(${table.baseCurrency}) = 3 AND ${table.baseCurrency} = upper(${table.baseCurrency})`,
    ),
    check(
      "user_states_transaction_currency_shape",
      sql`length(${table.lastTransactionCurrency}) = 3 AND ${table.lastTransactionCurrency} = upper(${table.lastTransactionCurrency})`,
    ),
    check(
      "user_states_language_supported",
      sql`${table.language} IN ('en', 'ko', 'ja', 'ru')`,
    ),
  ],
);

export const monthlyBudgets = sqliteTable(
  "monthly_budgets",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => userStates.ownerId, { onDelete: "cascade" }),
    month: text("month").notNull(),
    category: text("category", {
      enum: [
        "housing",
        "groceries",
        "dining",
        "transport",
        "utilities",
        "health",
        "education",
        "entertainment",
        "travel",
        "shopping",
        "subscriptions",
        "other",
      ],
    }).notNull(),
    amountUsdMinor: integer("amount_usd_minor").notNull(),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.month, table.category] }),
    index("idx_monthly_budgets_owner_month").on(table.ownerId, table.month),
    check(
      "monthly_budgets_month_shape",
      sql`length(${table.month}) = 7 AND ${table.month} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'`,
    ),
    check(
      "monthly_budgets_category_supported",
      sql`${table.category} IN ('housing', 'groceries', 'dining', 'transport', 'utilities', 'health', 'education', 'entertainment', 'travel', 'shopping', 'subscriptions', 'other')`,
    ),
    check(
      "monthly_budgets_amount_range",
      sql`${table.amountUsdMinor} > 0 AND ${table.amountUsdMinor} <= 9000000000000`,
    ),
    check(
      "monthly_budgets_timestamps",
      sql`${table.createdAtMs} > 0 AND ${table.updatedAtMs} >= ${table.createdAtMs}`,
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
      "exchange_rate_cache_quote_shape",
      sql`length(${table.quoteCurrency}) = 3 AND ${table.quoteCurrency} = upper(${table.quoteCurrency})`,
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
      "exchange_rate_snapshots_quote_shape",
      sql`length(${table.quoteCurrency}) = 3 AND ${table.quoteCurrency} = upper(${table.quoteCurrency})`,
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

export const recurringSeries = sqliteTable(
  "recurring_series",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => userStates.ownerId, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["expense", "income"] }).notNull(),
    startOn: text("start_on").notNull(),
    frequency: text("frequency", {
      enum: ["weekly", "monthly", "yearly"],
    }).notNull(),
    endsOn: text("ends_on"),
    pausedAtMs: integer("paused_at_ms"),
    originalAmountMinor: integer("original_amount_minor").notNull(),
    originalCurrency: text("original_currency").notNull(),
    originalCurrencyExponent: integer(
      "original_currency_exponent",
    ).notNull(),
    fallbackFxRate: text("fallback_fx_rate").notNull(),
    fallbackFxSource: text("fallback_fx_source", {
      enum: ["identity", "manual", "frankfurter"],
    }).notNull(),
    fallbackFxRateDate: text("fallback_fx_rate_date"),
    category: text("category").notNull().default("other"),
    subcategory: text("subcategory"),
    description: text("description").notNull(),
    note: text("note").notNull().default(""),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    check("recurring_series_id_length", sql`length(${table.id}) BETWEEN 1 AND 64`),
    check("recurring_series_kind", sql`${table.kind} IN ('expense', 'income')`),
    check(
      "recurring_series_dates",
      sql`length(${table.startOn}) = 10 AND ${table.startOn} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND (${table.endsOn} IS NULL OR (${table.endsOn} >= ${table.startOn} AND length(${table.endsOn}) = 10 AND ${table.endsOn} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'))`,
    ),
    check(
      "recurring_series_frequency",
      sql`${table.frequency} IN ('weekly', 'monthly', 'yearly')`,
    ),
    check(
      "recurring_series_amount_range",
      sql`${table.originalAmountMinor} > 0 AND ${table.originalAmountMinor} <= 9000000000000`,
    ),
    check(
      "recurring_series_currency",
      sql`length(${table.originalCurrency}) = 3 AND ${table.originalCurrency} = upper(${table.originalCurrency}) AND ${table.originalCurrencyExponent} BETWEEN 0 AND 4`,
    ),
    check(
      "recurring_series_fx",
      sql`length(${table.fallbackFxRate}) BETWEEN 1 AND 32 AND ((${table.fallbackFxSource} = 'frankfurter' AND ${table.fallbackFxRateDate} IS NOT NULL) OR (${table.fallbackFxSource} <> 'frankfurter' AND ${table.fallbackFxRateDate} IS NULL))`,
    ),
    check(
      "recurring_series_text",
      sql`length(${table.category}) BETWEEN 1 AND 40 AND length(${table.description}) BETWEEN 1 AND 120 AND length(${table.note}) <= 500`,
    ),
    check(
      "recurring_series_timestamps",
      sql`${table.createdAtMs} > 0 AND ${table.updatedAtMs} >= ${table.createdAtMs} AND (${table.pausedAtMs} IS NULL OR ${table.pausedAtMs} > 0)`,
    ),
    index("idx_recurring_series_owner_dates").on(
      table.ownerId,
      table.startOn,
      table.endsOn,
    ),
  ],
);

export const recurringExceptions = sqliteTable(
  "recurring_exceptions",
  {
    seriesId: text("series_id")
      .notNull()
      .references(() => recurringSeries.id, { onDelete: "cascade" }),
    occurrenceOn: text("occurrence_on").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => userStates.ownerId, { onDelete: "cascade" }),
    createdAtMs: integer("created_at_ms").notNull(),
  },
  (table) => [
    uniqueIndex("uq_recurring_exceptions_series_occurrence").on(
      table.seriesId,
      table.occurrenceOn,
    ),
    check(
      "recurring_exceptions_date",
      sql`length(${table.occurrenceOn}) = 10 AND ${table.occurrenceOn} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`,
    ),
    check(
      "recurring_exceptions_created_at",
      sql`${table.createdAtMs} > 0`,
    ),
    index("idx_recurring_exceptions_owner_occurrence").on(
      table.ownerId,
      table.occurrenceOn,
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
    subcategory: text("subcategory"),
    description: text("description").notNull(),
    note: text("note").notNull().default(""),
    recurringSeriesId: text("recurring_series_id").references(
      () => recurringSeries.id,
      { onDelete: "cascade" },
    ),
    recurrenceDate: text("recurrence_date"),
    splitGroupId: text("split_group_id"),
    splitIndex: integer("split_index"),
    splitCount: integer("split_count"),
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
      "transactions_recurrence",
      sql`(${table.recurringSeriesId} IS NULL AND ${table.recurrenceDate} IS NULL) OR (${table.recurringSeriesId} IS NOT NULL AND length(${table.recurrenceDate}) = 10 AND ${table.recurrenceDate} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`,
    ),
    check(
      "transactions_split_shape",
      sql`(${table.splitGroupId} IS NULL AND ${table.splitIndex} IS NULL AND ${table.splitCount} IS NULL) OR (${table.splitGroupId} IS NOT NULL AND length(${table.splitGroupId}) BETWEEN 1 AND 64 AND ${table.splitIndex} BETWEEN 0 AND ${table.splitCount} - 1 AND ${table.splitCount} BETWEEN 2 AND 365)`,
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
    uniqueIndex("uq_transactions_recurring_occurrence")
      .on(table.ownerId, table.recurringSeriesId, table.recurrenceDate)
      .where(sql`${table.recurringSeriesId} IS NOT NULL`),
    index("idx_transactions_owner_split_group").on(
      table.ownerId,
      table.splitGroupId,
    ),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type ExchangeRateCache = typeof exchangeRateCache.$inferSelect;
export type ExchangeRateSnapshot = typeof exchangeRateSnapshots.$inferSelect;
export type RecurringSeries = typeof recurringSeries.$inferSelect;
export type NewRecurringSeries = typeof recurringSeries.$inferInsert;
export type MonthlyBudget = typeof monthlyBudgets.$inferSelect;

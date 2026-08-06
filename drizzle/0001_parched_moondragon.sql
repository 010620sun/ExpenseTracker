CREATE TABLE `exchange_rate_cache` (
	`quote_currency` text PRIMARY KEY NOT NULL,
	`base_currency` text DEFAULT 'USD' NOT NULL,
	`usd_per_unit` text NOT NULL,
	`rate_date` text NOT NULL,
	`fetched_at_ms` integer NOT NULL,
	`source` text DEFAULT 'frankfurter' NOT NULL,
	CONSTRAINT "exchange_rate_cache_supported_quote" CHECK("exchange_rate_cache"."quote_currency" IN ('KRW', 'EUR', 'JPY', 'GBP', 'SGD', 'CAD', 'AUD')),
	CONSTRAINT "exchange_rate_cache_base_usd" CHECK("exchange_rate_cache"."base_currency" = 'USD'),
	CONSTRAINT "exchange_rate_cache_rate_length" CHECK(length("exchange_rate_cache"."usd_per_unit") BETWEEN 1 AND 32),
	CONSTRAINT "exchange_rate_cache_rate_date_shape" CHECK(length("exchange_rate_cache"."rate_date") = 10 AND "exchange_rate_cache"."rate_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "exchange_rate_cache_fetched_at_positive" CHECK("exchange_rate_cache"."fetched_at_ms" > 0),
	CONSTRAINT "exchange_rate_cache_source" CHECK("exchange_rate_cache"."source" = 'frankfurter')
);
--> statement-breakpoint
CREATE TABLE `exchange_rate_snapshots` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`quote_currency` text NOT NULL,
	`base_currency` text DEFAULT 'USD' NOT NULL,
	`usd_per_unit` text NOT NULL,
	`rate_date` text NOT NULL,
	`fetched_at_ms` integer NOT NULL,
	`source` text DEFAULT 'frankfurter' NOT NULL,
	CONSTRAINT "exchange_rate_snapshots_id" CHECK(length("exchange_rate_snapshots"."snapshot_id") BETWEEN 1 AND 64 AND "exchange_rate_snapshots"."snapshot_id" = "exchange_rate_snapshots"."quote_currency" || ':' || "exchange_rate_snapshots"."rate_date" || ':' || "exchange_rate_snapshots"."usd_per_unit"),
	CONSTRAINT "exchange_rate_snapshots_supported_quote" CHECK("exchange_rate_snapshots"."quote_currency" IN ('KRW', 'EUR', 'JPY', 'GBP', 'SGD', 'CAD', 'AUD')),
	CONSTRAINT "exchange_rate_snapshots_base_usd" CHECK("exchange_rate_snapshots"."base_currency" = 'USD'),
	CONSTRAINT "exchange_rate_snapshots_rate_length" CHECK(length("exchange_rate_snapshots"."usd_per_unit") BETWEEN 1 AND 32),
	CONSTRAINT "exchange_rate_snapshots_rate_date_shape" CHECK(length("exchange_rate_snapshots"."rate_date") = 10 AND "exchange_rate_snapshots"."rate_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "exchange_rate_snapshots_fetched_at_positive" CHECK("exchange_rate_snapshots"."fetched_at_ms" > 0),
	CONSTRAINT "exchange_rate_snapshots_source" CHECK("exchange_rate_snapshots"."source" = 'frankfurter')
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_on` text NOT NULL,
	`original_amount_minor` integer NOT NULL,
	`original_currency` text NOT NULL,
	`original_currency_exponent` integer NOT NULL,
	`fx_rate` text NOT NULL,
	`fx_source` text NOT NULL,
	`fx_rate_date` text,
	`fx_captured_at_ms` integer NOT NULL,
	`base_amount_minor` integer NOT NULL,
	`base_currency` text DEFAULT 'USD' NOT NULL,
	`base_currency_exponent` integer DEFAULT 2 NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`description` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`client_request_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user_states`(`owner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "transactions_id_length" CHECK(length("__new_transactions"."id") BETWEEN 1 AND 64),
	CONSTRAINT "transactions_kind" CHECK("__new_transactions"."kind" IN ('expense', 'income')),
	CONSTRAINT "transactions_occurred_on_shape" CHECK(length("__new_transactions"."occurred_on") = 10 AND "__new_transactions"."occurred_on" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "transactions_original_amount_range" CHECK("__new_transactions"."original_amount_minor" > 0 AND "__new_transactions"."original_amount_minor" <= 9000000000000),
	CONSTRAINT "transactions_base_amount_range" CHECK("__new_transactions"."base_amount_minor" >= 0 AND "__new_transactions"."base_amount_minor" <= 9000000000000),
	CONSTRAINT "transactions_original_currency_shape" CHECK(length("__new_transactions"."original_currency") = 3 AND "__new_transactions"."original_currency" = upper("__new_transactions"."original_currency")),
	CONSTRAINT "transactions_original_exponent_range" CHECK("__new_transactions"."original_currency_exponent" BETWEEN 0 AND 4),
	CONSTRAINT "transactions_fx_rate_length" CHECK(length("__new_transactions"."fx_rate") BETWEEN 1 AND 32),
	CONSTRAINT "transactions_fx_source" CHECK("__new_transactions"."fx_source" IN ('identity', 'manual', 'sample', 'frankfurter')),
	CONSTRAINT "transactions_fx_rate_date_shape" CHECK("__new_transactions"."fx_rate_date" IS NULL OR (length("__new_transactions"."fx_rate_date") = 10 AND "__new_transactions"."fx_rate_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')),
	CONSTRAINT "transactions_fx_provenance" CHECK(("__new_transactions"."fx_source" = 'frankfurter' AND "__new_transactions"."fx_rate_date" IS NOT NULL) OR ("__new_transactions"."fx_source" <> 'frankfurter' AND "__new_transactions"."fx_rate_date" IS NULL)),
	CONSTRAINT "transactions_timestamps_positive" CHECK("__new_transactions"."fx_captured_at_ms" > 0 AND "__new_transactions"."created_at_ms" > 0 AND "__new_transactions"."updated_at_ms" >= "__new_transactions"."created_at_ms"),
	CONSTRAINT "transactions_base_currency_usd" CHECK("__new_transactions"."base_currency" = 'USD' AND "__new_transactions"."base_currency_exponent" = 2),
	CONSTRAINT "transactions_identity_conversion" CHECK(("__new_transactions"."original_currency" = 'USD' AND "__new_transactions"."fx_source" = 'identity' AND "__new_transactions"."fx_rate" = '1' AND "__new_transactions"."original_amount_minor" = "__new_transactions"."base_amount_minor") OR ("__new_transactions"."original_currency" <> 'USD' AND "__new_transactions"."fx_source" <> 'identity')),
	CONSTRAINT "transactions_category_length" CHECK(length("__new_transactions"."category") BETWEEN 1 AND 40),
	CONSTRAINT "transactions_description_length" CHECK(length("__new_transactions"."description") BETWEEN 1 AND 120),
	CONSTRAINT "transactions_note_length" CHECK(length("__new_transactions"."note") <= 500),
	CONSTRAINT "transactions_client_request_id_length" CHECK("__new_transactions"."client_request_id" IS NULL OR length("__new_transactions"."client_request_id") BETWEEN 1 AND 64)
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "owner_id", "kind", "occurred_on", "original_amount_minor", "original_currency", "original_currency_exponent", "fx_rate", "fx_source", "fx_rate_date", "fx_captured_at_ms", "base_amount_minor", "base_currency", "base_currency_exponent", "category", "description", "note", "client_request_id", "created_at_ms", "updated_at_ms") SELECT "id", "owner_id", "kind", "occurred_on", "original_amount_minor", "original_currency", "original_currency_exponent", "fx_rate", "fx_source", NULL, "fx_captured_at_ms", "base_amount_minor", "base_currency", "base_currency_exponent", "category", "description", "note", "client_request_id", "created_at_ms", "updated_at_ms" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_transactions_owner_occurred` ON `transactions` (`owner_id`,`occurred_on`,`created_at_ms`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_transactions_owner_client_request` ON `transactions` (`owner_id`,`client_request_id`) WHERE "transactions"."client_request_id" IS NOT NULL;

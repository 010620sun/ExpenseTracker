PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exchange_rate_cache` (
	`quote_currency` text PRIMARY KEY NOT NULL,
	`base_currency` text DEFAULT 'USD' NOT NULL,
	`usd_per_unit` text NOT NULL,
	`rate_date` text NOT NULL,
	`fetched_at_ms` integer NOT NULL,
	`source` text DEFAULT 'frankfurter' NOT NULL,
	CONSTRAINT "exchange_rate_cache_quote_shape" CHECK(length("__new_exchange_rate_cache"."quote_currency") = 3 AND "__new_exchange_rate_cache"."quote_currency" = upper("__new_exchange_rate_cache"."quote_currency")),
	CONSTRAINT "exchange_rate_cache_base_usd" CHECK("__new_exchange_rate_cache"."base_currency" = 'USD'),
	CONSTRAINT "exchange_rate_cache_rate_length" CHECK(length("__new_exchange_rate_cache"."usd_per_unit") BETWEEN 1 AND 32),
	CONSTRAINT "exchange_rate_cache_rate_date_shape" CHECK(length("__new_exchange_rate_cache"."rate_date") = 10 AND "__new_exchange_rate_cache"."rate_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "exchange_rate_cache_fetched_at_positive" CHECK("__new_exchange_rate_cache"."fetched_at_ms" > 0),
	CONSTRAINT "exchange_rate_cache_source" CHECK("__new_exchange_rate_cache"."source" = 'frankfurter')
);
--> statement-breakpoint
INSERT INTO `__new_exchange_rate_cache`("quote_currency", "base_currency", "usd_per_unit", "rate_date", "fetched_at_ms", "source") SELECT "quote_currency", "base_currency", "usd_per_unit", "rate_date", "fetched_at_ms", "source" FROM `exchange_rate_cache`;--> statement-breakpoint
DROP TABLE `exchange_rate_cache`;--> statement-breakpoint
ALTER TABLE `__new_exchange_rate_cache` RENAME TO `exchange_rate_cache`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_exchange_rate_snapshots` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`quote_currency` text NOT NULL,
	`base_currency` text DEFAULT 'USD' NOT NULL,
	`usd_per_unit` text NOT NULL,
	`rate_date` text NOT NULL,
	`fetched_at_ms` integer NOT NULL,
	`source` text DEFAULT 'frankfurter' NOT NULL,
	CONSTRAINT "exchange_rate_snapshots_id" CHECK(length("__new_exchange_rate_snapshots"."snapshot_id") BETWEEN 1 AND 64 AND "__new_exchange_rate_snapshots"."snapshot_id" = "__new_exchange_rate_snapshots"."quote_currency" || ':' || "__new_exchange_rate_snapshots"."rate_date" || ':' || "__new_exchange_rate_snapshots"."usd_per_unit"),
	CONSTRAINT "exchange_rate_snapshots_quote_shape" CHECK(length("__new_exchange_rate_snapshots"."quote_currency") = 3 AND "__new_exchange_rate_snapshots"."quote_currency" = upper("__new_exchange_rate_snapshots"."quote_currency")),
	CONSTRAINT "exchange_rate_snapshots_base_usd" CHECK("__new_exchange_rate_snapshots"."base_currency" = 'USD'),
	CONSTRAINT "exchange_rate_snapshots_rate_length" CHECK(length("__new_exchange_rate_snapshots"."usd_per_unit") BETWEEN 1 AND 32),
	CONSTRAINT "exchange_rate_snapshots_rate_date_shape" CHECK(length("__new_exchange_rate_snapshots"."rate_date") = 10 AND "__new_exchange_rate_snapshots"."rate_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "exchange_rate_snapshots_fetched_at_positive" CHECK("__new_exchange_rate_snapshots"."fetched_at_ms" > 0),
	CONSTRAINT "exchange_rate_snapshots_source" CHECK("__new_exchange_rate_snapshots"."source" = 'frankfurter')
);
--> statement-breakpoint
INSERT INTO `__new_exchange_rate_snapshots`("snapshot_id", "quote_currency", "base_currency", "usd_per_unit", "rate_date", "fetched_at_ms", "source") SELECT "snapshot_id", "quote_currency", "base_currency", "usd_per_unit", "rate_date", "fetched_at_ms", "source" FROM `exchange_rate_snapshots`;--> statement-breakpoint
DROP TABLE `exchange_rate_snapshots`;--> statement-breakpoint
ALTER TABLE `__new_exchange_rate_snapshots` RENAME TO `exchange_rate_snapshots`;
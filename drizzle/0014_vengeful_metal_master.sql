CREATE TABLE `exchange_rate_pairs` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`requested_date` text NOT NULL,
	`quote_currency` text NOT NULL,
	`base_currency` text DEFAULT 'USD' NOT NULL,
	`usd_per_unit` text NOT NULL,
	`rate_date` text NOT NULL,
	`fetched_at_ms` integer NOT NULL,
	`source` text DEFAULT 'frankfurter' NOT NULL,
	CONSTRAINT "exchange_rate_pairs_key" CHECK(length("exchange_rate_pairs"."cache_key") = 14 AND "exchange_rate_pairs"."cache_key" = "exchange_rate_pairs"."requested_date" || ':' || "exchange_rate_pairs"."quote_currency"),
	CONSTRAINT "exchange_rate_pairs_requested_date_shape" CHECK(length("exchange_rate_pairs"."requested_date") = 10 AND "exchange_rate_pairs"."requested_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "exchange_rate_pairs_quote_shape" CHECK(length("exchange_rate_pairs"."quote_currency") = 3 AND "exchange_rate_pairs"."quote_currency" = upper("exchange_rate_pairs"."quote_currency")),
	CONSTRAINT "exchange_rate_pairs_base_usd" CHECK("exchange_rate_pairs"."base_currency" = 'USD'),
	CONSTRAINT "exchange_rate_pairs_rate_length" CHECK(length("exchange_rate_pairs"."usd_per_unit") BETWEEN 1 AND 32),
	CONSTRAINT "exchange_rate_pairs_rate_date_shape" CHECK(length("exchange_rate_pairs"."rate_date") = 10 AND "exchange_rate_pairs"."rate_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "exchange_rate_pairs_fetched_at_positive" CHECK("exchange_rate_pairs"."fetched_at_ms" > 0),
	CONSTRAINT "exchange_rate_pairs_source" CHECK("exchange_rate_pairs"."source" = 'frankfurter')
);
--> statement-breakpoint
INSERT INTO `exchange_rate_pairs` (
	`cache_key`,
	`requested_date`,
	`quote_currency`,
	`base_currency`,
	`usd_per_unit`,
	`rate_date`,
	`fetched_at_ms`,
	`source`
)
SELECT
	`rate_date` || ':' || `quote_currency`,
	`rate_date`,
	`quote_currency`,
	`base_currency`,
	`usd_per_unit`,
	`rate_date`,
	`fetched_at_ms`,
	`source`
FROM (
	SELECT
		*,
		row_number() OVER (
			PARTITION BY `rate_date`, `quote_currency`
			ORDER BY `fetched_at_ms` DESC, `snapshot_id` DESC
		) AS `cache_rank`
	FROM `exchange_rate_snapshots`
)
WHERE `cache_rank` = 1;
--> statement-breakpoint
CREATE INDEX `idx_exchange_rate_pairs_requested_date` ON `exchange_rate_pairs` (`requested_date`,`quote_currency`);--> statement-breakpoint
DROP TABLE `exchange_rate_snapshots`;

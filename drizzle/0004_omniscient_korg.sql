PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recurring_series` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`start_on` text NOT NULL,
	`frequency` text NOT NULL,
	`ends_on` text,
	`paused_at_ms` integer,
	`original_amount_minor` integer NOT NULL,
	`original_currency` text NOT NULL,
	`original_currency_exponent` integer NOT NULL,
	`fallback_fx_rate` text NOT NULL,
	`fallback_fx_source` text NOT NULL,
	`fallback_fx_rate_date` text,
	`category` text DEFAULT 'other' NOT NULL,
	`description` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user_states`(`owner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recurring_series_id_length" CHECK(length("__new_recurring_series"."id") BETWEEN 1 AND 64),
	CONSTRAINT "recurring_series_kind" CHECK("__new_recurring_series"."kind" IN ('expense', 'income')),
	CONSTRAINT "recurring_series_dates" CHECK(length("__new_recurring_series"."start_on") = 10 AND "__new_recurring_series"."start_on" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND ("__new_recurring_series"."ends_on" IS NULL OR ("__new_recurring_series"."ends_on" >= "__new_recurring_series"."start_on" AND length("__new_recurring_series"."ends_on") = 10 AND "__new_recurring_series"."ends_on" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'))),
	CONSTRAINT "recurring_series_frequency" CHECK("__new_recurring_series"."frequency" IN ('weekly', 'monthly', 'yearly')),
	CONSTRAINT "recurring_series_amount_range" CHECK("__new_recurring_series"."original_amount_minor" > 0 AND "__new_recurring_series"."original_amount_minor" <= 9000000000000),
	CONSTRAINT "recurring_series_currency" CHECK(length("__new_recurring_series"."original_currency") = 3 AND "__new_recurring_series"."original_currency" = upper("__new_recurring_series"."original_currency") AND "__new_recurring_series"."original_currency_exponent" BETWEEN 0 AND 4),
	CONSTRAINT "recurring_series_fx" CHECK(length("__new_recurring_series"."fallback_fx_rate") BETWEEN 1 AND 32 AND (("__new_recurring_series"."fallback_fx_source" = 'frankfurter' AND "__new_recurring_series"."fallback_fx_rate_date" IS NOT NULL) OR ("__new_recurring_series"."fallback_fx_source" <> 'frankfurter' AND "__new_recurring_series"."fallback_fx_rate_date" IS NULL))),
	CONSTRAINT "recurring_series_text" CHECK(length("__new_recurring_series"."category") BETWEEN 1 AND 40 AND length("__new_recurring_series"."description") BETWEEN 1 AND 120 AND length("__new_recurring_series"."note") <= 500),
	CONSTRAINT "recurring_series_timestamps" CHECK("__new_recurring_series"."created_at_ms" > 0 AND "__new_recurring_series"."updated_at_ms" >= "__new_recurring_series"."created_at_ms" AND ("__new_recurring_series"."paused_at_ms" IS NULL OR "__new_recurring_series"."paused_at_ms" > 0))
);
--> statement-breakpoint
INSERT INTO `__new_recurring_series`("id", "owner_id", "kind", "start_on", "frequency", "ends_on", "paused_at_ms", "original_amount_minor", "original_currency", "original_currency_exponent", "fallback_fx_rate", "fallback_fx_source", "fallback_fx_rate_date", "category", "description", "note", "created_at_ms", "updated_at_ms") SELECT "id", "owner_id", "kind", "start_on", "frequency", "ends_on", NULL, "original_amount_minor", "original_currency", "original_currency_exponent", "fallback_fx_rate", "fallback_fx_source", "fallback_fx_rate_date", "category", "description", "note", "created_at_ms", "updated_at_ms" FROM `recurring_series`;--> statement-breakpoint
DROP TABLE `recurring_series`;--> statement-breakpoint
ALTER TABLE `__new_recurring_series` RENAME TO `recurring_series`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_recurring_series_owner_dates` ON `recurring_series` (`owner_id`,`start_on`,`ends_on`);

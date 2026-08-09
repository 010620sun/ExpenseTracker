CREATE TABLE `recurring_exceptions` (
	`series_id` text NOT NULL,
	`occurrence_on` text NOT NULL,
	`owner_id` text NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`series_id`) REFERENCES `recurring_series`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `user_states`(`owner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recurring_exceptions_date" CHECK(length("recurring_exceptions"."occurrence_on") = 10 AND "recurring_exceptions"."occurrence_on" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "recurring_exceptions_created_at" CHECK("recurring_exceptions"."created_at_ms" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_recurring_exceptions_series_occurrence` ON `recurring_exceptions` (`series_id`,`occurrence_on`);--> statement-breakpoint
CREATE INDEX `idx_recurring_exceptions_owner_occurrence` ON `recurring_exceptions` (`owner_id`,`occurrence_on`);--> statement-breakpoint
CREATE TABLE `recurring_series` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`start_on` text NOT NULL,
	`frequency` text NOT NULL,
	`ends_on` text,
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
	CONSTRAINT "recurring_series_id_length" CHECK(length("recurring_series"."id") BETWEEN 1 AND 64),
	CONSTRAINT "recurring_series_kind" CHECK("recurring_series"."kind" IN ('expense', 'income')),
	CONSTRAINT "recurring_series_dates" CHECK(length("recurring_series"."start_on") = 10 AND "recurring_series"."start_on" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND ("recurring_series"."ends_on" IS NULL OR ("recurring_series"."ends_on" >= "recurring_series"."start_on" AND length("recurring_series"."ends_on") = 10 AND "recurring_series"."ends_on" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'))),
	CONSTRAINT "recurring_series_frequency" CHECK("recurring_series"."frequency" IN ('weekly', 'monthly', 'yearly')),
	CONSTRAINT "recurring_series_amount_range" CHECK("recurring_series"."original_amount_minor" > 0 AND "recurring_series"."original_amount_minor" <= 9000000000000),
	CONSTRAINT "recurring_series_currency" CHECK(length("recurring_series"."original_currency") = 3 AND "recurring_series"."original_currency" = upper("recurring_series"."original_currency") AND "recurring_series"."original_currency_exponent" BETWEEN 0 AND 4),
	CONSTRAINT "recurring_series_fx" CHECK(length("recurring_series"."fallback_fx_rate") BETWEEN 1 AND 32 AND (("recurring_series"."fallback_fx_source" = 'frankfurter' AND "recurring_series"."fallback_fx_rate_date" IS NOT NULL) OR ("recurring_series"."fallback_fx_source" <> 'frankfurter' AND "recurring_series"."fallback_fx_rate_date" IS NULL))),
	CONSTRAINT "recurring_series_text" CHECK(length("recurring_series"."category") BETWEEN 1 AND 40 AND length("recurring_series"."description") BETWEEN 1 AND 120 AND length("recurring_series"."note") <= 500),
	CONSTRAINT "recurring_series_timestamps" CHECK("recurring_series"."created_at_ms" > 0 AND "recurring_series"."updated_at_ms" >= "recurring_series"."created_at_ms")
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_series_owner_dates` ON `recurring_series` (`owner_id`,`start_on`,`ends_on`);--> statement-breakpoint
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
	`recurring_series_id` text,
	`recurrence_date` text,
	`client_request_id` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user_states`(`owner_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recurring_series_id`) REFERENCES `recurring_series`(`id`) ON UPDATE no action ON DELETE cascade,
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
	CONSTRAINT "transactions_recurrence" CHECK(("__new_transactions"."recurring_series_id" IS NULL AND "__new_transactions"."recurrence_date" IS NULL) OR ("__new_transactions"."recurring_series_id" IS NOT NULL AND length("__new_transactions"."recurrence_date") = 10 AND "__new_transactions"."recurrence_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')),
	CONSTRAINT "transactions_client_request_id_length" CHECK("__new_transactions"."client_request_id" IS NULL OR length("__new_transactions"."client_request_id") BETWEEN 1 AND 64)
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "owner_id", "kind", "occurred_on", "original_amount_minor", "original_currency", "original_currency_exponent", "fx_rate", "fx_source", "fx_rate_date", "fx_captured_at_ms", "base_amount_minor", "base_currency", "base_currency_exponent", "category", "description", "note", "recurring_series_id", "recurrence_date", "client_request_id", "created_at_ms", "updated_at_ms") SELECT "id", "owner_id", "kind", "occurred_on", "original_amount_minor", "original_currency", "original_currency_exponent", "fx_rate", "fx_source", "fx_rate_date", "fx_captured_at_ms", "base_amount_minor", "base_currency", "base_currency_exponent", "category", "description", "note", NULL, NULL, "client_request_id", "created_at_ms", "updated_at_ms" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_transactions_owner_occurred` ON `transactions` (`owner_id`,`occurred_on`,`created_at_ms`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_transactions_owner_client_request` ON `transactions` (`owner_id`,`client_request_id`) WHERE "transactions"."client_request_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_transactions_recurring_occurrence` ON `transactions` (`owner_id`,`recurring_series_id`,`recurrence_date`) WHERE "transactions"."recurring_series_id" IS NOT NULL;

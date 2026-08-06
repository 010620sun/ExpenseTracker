CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`occurred_on` text NOT NULL,
	`original_amount_minor` integer NOT NULL,
	`original_currency` text NOT NULL,
	`original_currency_exponent` integer NOT NULL,
	`fx_rate` text NOT NULL,
	`fx_source` text NOT NULL,
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
	CONSTRAINT "transactions_id_length" CHECK(length("transactions"."id") BETWEEN 1 AND 64),
	CONSTRAINT "transactions_kind" CHECK("transactions"."kind" IN ('expense', 'income')),
	CONSTRAINT "transactions_occurred_on_shape" CHECK(length("transactions"."occurred_on") = 10 AND "transactions"."occurred_on" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "transactions_original_amount_range" CHECK("transactions"."original_amount_minor" > 0 AND "transactions"."original_amount_minor" <= 9000000000000),
	CONSTRAINT "transactions_base_amount_range" CHECK("transactions"."base_amount_minor" >= 0 AND "transactions"."base_amount_minor" <= 9000000000000),
	CONSTRAINT "transactions_original_currency_shape" CHECK(length("transactions"."original_currency") = 3 AND "transactions"."original_currency" = upper("transactions"."original_currency")),
	CONSTRAINT "transactions_original_exponent_range" CHECK("transactions"."original_currency_exponent" BETWEEN 0 AND 4),
	CONSTRAINT "transactions_fx_rate_length" CHECK(length("transactions"."fx_rate") BETWEEN 1 AND 32),
	CONSTRAINT "transactions_fx_source" CHECK("transactions"."fx_source" IN ('identity', 'manual', 'sample')),
	CONSTRAINT "transactions_timestamps_positive" CHECK("transactions"."fx_captured_at_ms" > 0 AND "transactions"."created_at_ms" > 0 AND "transactions"."updated_at_ms" >= "transactions"."created_at_ms"),
	CONSTRAINT "transactions_base_currency_usd" CHECK("transactions"."base_currency" = 'USD' AND "transactions"."base_currency_exponent" = 2),
	CONSTRAINT "transactions_identity_conversion" CHECK("transactions"."original_currency" <> 'USD' OR ("transactions"."fx_rate" = '1' AND "transactions"."original_amount_minor" = "transactions"."base_amount_minor")),
	CONSTRAINT "transactions_category_length" CHECK(length("transactions"."category") BETWEEN 1 AND 40),
	CONSTRAINT "transactions_description_length" CHECK(length("transactions"."description") BETWEEN 1 AND 120),
	CONSTRAINT "transactions_note_length" CHECK(length("transactions"."note") <= 500),
	CONSTRAINT "transactions_client_request_id_length" CHECK("transactions"."client_request_id" IS NULL OR length("transactions"."client_request_id") BETWEEN 1 AND 64)
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_owner_occurred` ON `transactions` (`owner_id`,`occurred_on`,`created_at_ms`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_transactions_owner_client_request` ON `transactions` (`owner_id`,`client_request_id`) WHERE "transactions"."client_request_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `user_states` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`samples_seeded_at_ms` integer,
	`created_at_ms` integer NOT NULL,
	CONSTRAINT "user_states_owner_id_length" CHECK(length("user_states"."owner_id") BETWEEN 1 AND 255),
	CONSTRAINT "user_states_created_at_positive" CHECK("user_states"."created_at_ms" > 0)
);

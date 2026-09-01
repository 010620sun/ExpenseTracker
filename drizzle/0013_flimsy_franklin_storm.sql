PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_states` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`samples_seeded_at_ms` integer,
	`base_currency` text DEFAULT 'USD' NOT NULL,
	`base_currency_configured_at_ms` integer,
	`last_transaction_currency` text DEFAULT 'KRW' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`created_at_ms` integer NOT NULL,
	CONSTRAINT "user_states_owner_id_length" CHECK(length("__new_user_states"."owner_id") BETWEEN 1 AND 255),
	CONSTRAINT "user_states_created_at_positive" CHECK("__new_user_states"."created_at_ms" > 0),
	CONSTRAINT "user_states_base_currency_configured_at_positive" CHECK("__new_user_states"."base_currency_configured_at_ms" IS NULL OR "__new_user_states"."base_currency_configured_at_ms" > 0),
	CONSTRAINT "user_states_base_currency_shape" CHECK(length("__new_user_states"."base_currency") = 3 AND "__new_user_states"."base_currency" = upper("__new_user_states"."base_currency")),
	CONSTRAINT "user_states_transaction_currency_shape" CHECK(length("__new_user_states"."last_transaction_currency") = 3 AND "__new_user_states"."last_transaction_currency" = upper("__new_user_states"."last_transaction_currency")),
	CONSTRAINT "user_states_language_supported" CHECK("__new_user_states"."language" IN ('en', 'ko', 'ja', 'ru'))
);
--> statement-breakpoint
INSERT INTO `__new_user_states`("owner_id", "samples_seeded_at_ms", "base_currency", "base_currency_configured_at_ms", "last_transaction_currency", "language", "created_at_ms") SELECT "owner_id", "samples_seeded_at_ms", "base_currency", NULL, "last_transaction_currency", "language", "created_at_ms" FROM `user_states`;--> statement-breakpoint
DROP TABLE `user_states`;--> statement-breakpoint
ALTER TABLE `__new_user_states` RENAME TO `user_states`;--> statement-breakpoint
PRAGMA foreign_keys=ON;

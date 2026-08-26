PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_monthly_budgets` (
	`owner_id` text NOT NULL,
	`month` text NOT NULL,
	`category` text NOT NULL,
	`amount_usd_minor` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `month`, `category`),
	FOREIGN KEY (`owner_id`) REFERENCES `user_states`(`owner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "monthly_budgets_month_shape" CHECK(length("__new_monthly_budgets"."month") = 7 AND "__new_monthly_budgets"."month" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "monthly_budgets_category_supported" CHECK("__new_monthly_budgets"."category" IN ('housing', 'utilities', 'communication', 'groceries', 'dining', 'transport', 'vehicle', 'travel', 'health', 'personal_care', 'education', 'shopping', 'entertainment', 'subscriptions', 'family', 'pets', 'gifts', 'insurance', 'taxes', 'financial', 'other')),
	CONSTRAINT "monthly_budgets_amount_range" CHECK("__new_monthly_budgets"."amount_usd_minor" > 0 AND "__new_monthly_budgets"."amount_usd_minor" <= 9000000000000),
	CONSTRAINT "monthly_budgets_timestamps" CHECK("__new_monthly_budgets"."created_at_ms" > 0 AND "__new_monthly_budgets"."updated_at_ms" >= "__new_monthly_budgets"."created_at_ms")
);
--> statement-breakpoint
INSERT INTO `__new_monthly_budgets`("owner_id", "month", "category", "amount_usd_minor", "created_at_ms", "updated_at_ms") SELECT "owner_id", "month", "category", "amount_usd_minor", "created_at_ms", "updated_at_ms" FROM `monthly_budgets`;--> statement-breakpoint
DROP TABLE `monthly_budgets`;--> statement-breakpoint
ALTER TABLE `__new_monthly_budgets` RENAME TO `monthly_budgets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_monthly_budgets_owner_month` ON `monthly_budgets` (`owner_id`,`month`);

CREATE TABLE `monthly_budgets` (
	`owner_id` text NOT NULL,
	`month` text NOT NULL,
	`category` text NOT NULL,
	`amount_usd_minor` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	PRIMARY KEY(`owner_id`, `month`, `category`),
	FOREIGN KEY (`owner_id`) REFERENCES `user_states`(`owner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "monthly_budgets_month_shape" CHECK(length("monthly_budgets"."month") = 7 AND "monthly_budgets"."month" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "monthly_budgets_category_supported" CHECK("monthly_budgets"."category" IN ('housing', 'groceries', 'dining', 'transport', 'utilities', 'health', 'education', 'entertainment', 'travel', 'shopping', 'subscriptions', 'other')),
	CONSTRAINT "monthly_budgets_amount_range" CHECK("monthly_budgets"."amount_usd_minor" > 0 AND "monthly_budgets"."amount_usd_minor" <= 9000000000000),
	CONSTRAINT "monthly_budgets_timestamps" CHECK("monthly_budgets"."created_at_ms" > 0 AND "monthly_budgets"."updated_at_ms" >= "monthly_budgets"."created_at_ms")
);
--> statement-breakpoint
CREATE INDEX `idx_monthly_budgets_owner_month` ON `monthly_budgets` (`owner_id`,`month`);
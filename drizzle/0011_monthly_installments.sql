ALTER TABLE `transactions` ADD `installment_group_id` text;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `installment_index` integer;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `installment_count` integer;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `installment_total_original_minor` integer;
--> statement-breakpoint
CREATE INDEX `idx_transactions_owner_installment_group` ON `transactions` (`owner_id`,`installment_group_id`);

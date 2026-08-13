CREATE TABLE `auth_rate_limits` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`window_started_at_ms` integer NOT NULL,
	`blocked_until_ms` integer,
	`updated_at_ms` integer NOT NULL,
	CONSTRAINT "auth_rate_limits_key_hash_length" CHECK(length("auth_rate_limits"."key_hash") BETWEEN 32 AND 128),
	CONSTRAINT "auth_rate_limits_attempts" CHECK("auth_rate_limits"."attempts" BETWEEN 0 AND 100),
	CONSTRAINT "auth_rate_limits_timestamps" CHECK("auth_rate_limits"."window_started_at_ms" > 0 AND "auth_rate_limits"."updated_at_ms" >= "auth_rate_limits"."window_started_at_ms" AND ("auth_rate_limits"."blocked_until_ms" IS NULL OR "auth_rate_limits"."blocked_until_ms" > "auth_rate_limits"."window_started_at_ms"))
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	CONSTRAINT "members_id_length" CHECK(length("members"."id") BETWEEN 1 AND 64),
	CONSTRAINT "members_email_shape" CHECK(length("members"."email") BETWEEN 3 AND 254 AND "members"."email" = lower("members"."email") AND instr("members"."email", '@') > 1),
	CONSTRAINT "members_display_name_length" CHECK(length("members"."display_name") BETWEEN 1 AND 80),
	CONSTRAINT "members_password_material" CHECK(length("members"."password_hash") BETWEEN 32 AND 128 AND length("members"."password_salt") BETWEEN 16 AND 64 AND "members"."password_iterations" BETWEEN 100000 AND 1000000),
	CONSTRAINT "members_timestamps" CHECK("members"."created_at_ms" > 0 AND "members"."updated_at_ms" >= "members"."created_at_ms")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_members_email` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at_ms` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	`last_seen_at_ms` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "auth_sessions_id_length" CHECK(length("auth_sessions"."id") BETWEEN 1 AND 64),
	CONSTRAINT "auth_sessions_token_hash_length" CHECK(length("auth_sessions"."token_hash") BETWEEN 32 AND 128),
	CONSTRAINT "auth_sessions_timestamps" CHECK("auth_sessions"."created_at_ms" > 0 AND "auth_sessions"."last_seen_at_ms" >= "auth_sessions"."created_at_ms" AND "auth_sessions"."expires_at_ms" > "auth_sessions"."created_at_ms")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_auth_sessions_token_hash` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_member_expires` ON `auth_sessions` (`member_id`,`expires_at_ms`);

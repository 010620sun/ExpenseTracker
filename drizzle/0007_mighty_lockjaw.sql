ALTER TABLE `user_states` ADD `language` text DEFAULT 'en' NOT NULL CONSTRAINT "user_states_language_supported" CHECK(`language` IN ('en', 'ko', 'ja', 'ru'));

ALTER TABLE `user_states`
ADD COLUMN `base_currency_configured_at_ms` integer
CHECK (`base_currency_configured_at_ms` IS NULL OR `base_currency_configured_at_ms` > 0);

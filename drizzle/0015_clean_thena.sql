PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- Keep the v1 labels available for audit and rollback. Monetary, FX, date,
-- ownership, split, installment, and recurrence fields are never rewritten.
CREATE TABLE `category_v1_transactions` AS
SELECT `id`, `category`, `subcategory` FROM `transactions`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_category_v1_transactions_id` ON `category_v1_transactions` (`id`);--> statement-breakpoint
CREATE TABLE `category_v1_recurring_series` AS
SELECT `id`, `category`, `subcategory` FROM `recurring_series`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_category_v1_recurring_series_id` ON `category_v1_recurring_series` (`id`);--> statement-breakpoint
CREATE TABLE `category_v1_monthly_budgets` AS
SELECT * FROM `monthly_budgets`;--> statement-breakpoint

ALTER TABLE `transactions` ADD COLUMN `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD COLUMN `category_version` integer DEFAULT 2 NOT NULL CHECK (`category_version` = 2);--> statement-breakpoint
ALTER TABLE `transactions` ADD COLUMN `classification_source` text DEFAULT 'manual' NOT NULL CHECK (`classification_source` IN ('legacy', 'rule', 'ai', 'manual', 'fallback'));--> statement-breakpoint
ALTER TABLE `transactions` ADD COLUMN `classification_confidence` integer CHECK (`classification_confidence` IS NULL OR `classification_confidence` BETWEEN 0 AND 100);--> statement-breakpoint

UPDATE `transactions`
SET
  `tags` = CASE
    WHEN `category` = 'travel' OR lower(`description`) LIKE '% to %' OR lower(`description`) GLOB '*hotel*' OR lower(`description`) GLOB '*hostel*' OR lower(`description`) GLOB '*airbnb*' THEN '["travel"]'
    WHEN `category` = 'pets' THEN '["pet"]'
    WHEN `category` = 'family' THEN '["family"]'
    WHEN `category` = 'gifts' THEN '["gift"]'
    ELSE '[]'
  END,
  `subcategory` = CASE
    WHEN `kind` = 'income' AND (`category` IN ('salary', 'income') OR lower(`description`) LIKE '%salary%') THEN CASE `subcategory` WHEN 'bonus' THEN 'bonus' WHEN 'allowance' THEN 'allowance' ELSE 'salary' END
    WHEN `kind` = 'income' AND `category` = 'freelance' THEN CASE `subcategory` WHEN 'consulting' THEN 'consulting' WHEN 'business_sales' THEN 'sales' ELSE 'freelance' END
    WHEN `kind` = 'income' AND `category` = 'investment_income' THEN CASE `subcategory` WHEN 'dividends' THEN 'dividends' WHEN 'capital_gains' THEN 'gains' ELSE 'investment_interest' END
    WHEN `kind` = 'income' AND `category` = 'refund' THEN CASE `subcategory` WHEN 'tax_refund' THEN 'tax_refund' WHEN 'reimbursement' THEN 'reimbursement' ELSE 'purchase_refund' END
    WHEN `kind` = 'income' AND `category` = 'gift_income' THEN CASE `subcategory` WHEN 'family_support' THEN 'family_support' ELSE 'gifts_received' END
    WHEN `kind` = 'income' AND `category` = 'other_income' THEN CASE `subcategory` WHEN 'prizes' THEN 'prizes' WHEN 'grants' THEN 'grants' ELSE 'unknown_income' END
    WHEN `kind` = 'income' THEN 'unknown_income'
    WHEN `description` = '?' THEN 'unknown'
    WHEN `subcategory` = 'visa_fees' OR lower(`description`) LIKE '% tax' OR lower(`description`) LIKE '% tax %' OR lower(`description`) = 'uk eta' OR lower(`description`) LIKE '%issue fee%' THEN 'government_fees'
    WHEN lower(`description`) GLOB '*hotel*' OR lower(`description`) GLOB '*hostel*' OR lower(`description`) GLOB '*airbnb*' THEN 'lodging'
    WHEN lower(`description`) IN ('dinner', 'lunch', 'breakfast', 'seoul lunch', 'lucnh', 'hamburger') THEN 'meals'
    WHEN lower(`description`) GLOB '*coffee*' OR lower(`description`) = 'cafe' OR lower(`description`) GLOB '*dessert*' OR lower(`description`) GLOB '*gelato*' OR lower(`description`) GLOB '*ice cream*' OR lower(`description`) GLOB '*icecream*' OR lower(`description`) GLOB '*egg tart*' THEN 'cafe'
    WHEN lower(`description`) GLOB '*beer*' OR lower(`description`) GLOB '*wine*' OR lower(`description`) = 'alcohol' THEN 'alcohol'
    WHEN lower(`description`) GLOB '*cigarette*' OR lower(`description`) = 'lighter' THEN 'tobacco'
    WHEN lower(`description`) GLOB '*face wash*' OR lower(`description`) GLOB '*sun block*' OR lower(`description`) GLOB '*lotion*' OR lower(`description`) GLOB '*balm*' THEN 'toiletries'
    WHEN lower(`description`) IN ('jacket', 'clothes', 'purchase of pants', 'slippers', 'socks') THEN 'clothing'
    WHEN lower(`description`) GLOB '*towel purchase*' OR lower(`description`) = 'towel' OR lower(`description`) GLOB '*vynil*' THEN 'other_goods'
    WHEN lower(`description`) GLOB '*taxi*' THEN 'taxi'
    WHEN lower(`description`) GLOB '*flight*' THEN 'flights'
    WHEN lower(`description`) GLOB '*rental*' AND (lower(`description`) GLOB '*bike*' OR lower(`description`) GLOB '*bicycle*' OR lower(`description`) GLOB '*scooter*' OR lower(`description`) GLOB '*motorbike*') THEN 'rentals'
    WHEN lower(`description`) GLOB '*gas fee*' OR lower(`description`) GLOB '*fuel*' THEN 'fuel'
    WHEN lower(`description`) GLOB '*parking*' OR lower(`description`) GLOB '*toll*' THEN 'parking'
    WHEN lower(`description`) GLOB '*bus*' OR lower(`description`) GLOB '*metro*' OR lower(`description`) GLOB '*train*' OR lower(`description`) GLOB '*tram*' OR lower(`description`) GLOB '*ferry*' OR lower(`description`) GLOB '*transit*' OR lower(`description`) = 'transport' OR lower(`description`) GLOB '*rail europe*' THEN 'transit'
    WHEN lower(`description`) GLOB '*youtube*' THEN 'streaming'
    WHEN `subcategory` = 'media_streaming' THEN 'streaming'
    WHEN `subcategory` = 'games' THEN 'games'
    WHEN `subcategory` = 'hobbies' THEN 'hobbies'
    WHEN `subcategory` = 'travel_activities' OR `subcategory` = 'movies_events' OR lower(`description`) GLOB '*ticket*' OR lower(`description`) GLOB '*attraction*' OR lower(`description`) GLOB '*opera*' OR lower(`description`) GLOB '*halloween*' THEN 'events'
    WHEN lower(`description`) GLOB '*tour*' OR lower(`description`) GLOB '*balloon*' OR lower(`description`) GLOB '*wine tasting*' THEN 'activities'
    WHEN lower(`description`) GLOB '*esim*' OR lower(`description`) GLOB '*mobile data*' OR lower(`description`) GLOB '*mobile dater*' THEN 'mobile'
    WHEN `subcategory` = 'mobile_phone' THEN 'mobile'
    WHEN `subcategory` = 'internet' THEN 'internet'
    WHEN `subcategory` = 'software' THEN 'software'
    WHEN `subcategory` = 'rent_mortgage' THEN 'rent'
    WHEN `subcategory` = 'home_maintenance' THEN 'repairs'
    WHEN `subcategory` IN ('electricity_gas', 'water', 'waste_management') THEN 'utilities'
    WHEN `subcategory` = 'furniture' THEN 'home_goods'
    WHEN `subcategory` IN ('supermarket', 'convenience_store') THEN 'groceries'
    WHEN `subcategory` = 'household_supplies' THEN 'essentials'
    WHEN `subcategory` IN ('restaurant', 'delivery_takeout') THEN 'meals'
    WHEN `subcategory` = 'cafe' THEN 'cafe'
    WHEN `subcategory` IN ('bus_subway', 'rail', 'travel_transport') THEN 'transit'
    WHEN `subcategory` = 'taxi_rideshare' THEN 'taxi'
    WHEN `subcategory` = 'flights' THEN 'flights'
    WHEN `subcategory` = 'fuel' THEN 'fuel'
    WHEN `subcategory` = 'parking_tolls' THEN 'parking'
    WHEN `subcategory` = 'vehicle_maintenance' THEN 'maintenance'
    WHEN `subcategory` IN ('clinic_hospital') THEN 'medical'
    WHEN `subcategory` = 'pharmacy' THEN 'pharmacy'
    WHEN `subcategory` = 'dental' THEN 'dental'
    WHEN `subcategory` = 'vision' THEN 'vision'
    WHEN `subcategory` IN ('fitness', 'spa_wellness') THEN 'fitness'
    WHEN `subcategory` IN ('hair_beauty', 'pet_grooming') THEN 'grooming'
    WHEN `subcategory` IN ('childcare', 'eldercare') THEN 'caregiving'
    WHEN `subcategory` = 'veterinary' THEN 'vet'
    WHEN `subcategory` = 'skincare' THEN 'toiletries'
    WHEN `subcategory` = 'tuition' THEN 'tuition'
    WHEN `subcategory` IN ('books_supplies', 'school_support') THEN 'materials'
    WHEN `subcategory` = 'online_courses' THEN 'courses'
    WHEN `subcategory` = 'clothing' THEN 'clothing'
    WHEN `subcategory` = 'electronics' THEN 'electronics'
    WHEN `subcategory` = 'home_goods' THEN 'home_goods'
    WHEN `subcategory` = 'pet_food' THEN 'pet_supplies'
    WHEN `subcategory` = 'health_insurance' OR `subcategory` = 'life_insurance' OR `subcategory` = 'property_insurance' THEN 'insurance'
    WHEN `subcategory` IN ('income_tax', 'property_tax') THEN 'taxes'
    WHEN `subcategory` = 'government_fees' THEN 'government_fees'
    WHEN `subcategory` IN ('bank_fees', 'card_fees') THEN 'bank_fees'
    WHEN `subcategory` = 'loan_interest' THEN 'interest'
    WHEN `subcategory` = 'donations' THEN 'donations'
    WHEN `subcategory` IN ('gifts_given', 'celebrations') THEN 'cash_gifts'
    WHEN `subcategory` = 'postal_services' THEN 'postage'
    WHEN lower(`description`) GLOB '*laundry*' THEN 'laundry'
    WHEN lower(`description`) GLOB '*locker*' THEN 'storage'
    WHEN lower(`description`) GLOB '*toilet*' OR lower(`description`) GLOB '*toiliet*' OR lower(`description`) GLOB '*rental fee*' OR lower(`description`) GLOB '*service fee*' THEN 'services'
    WHEN `category` = 'housing' THEN 'rent'
    WHEN `category` = 'utilities' THEN 'utilities'
    WHEN `category` = 'communication' THEN 'internet'
    WHEN `category` = 'groceries' THEN 'groceries'
    WHEN `category` = 'dining' THEN 'meals'
    WHEN `category` IN ('transport', 'travel') THEN 'transit'
    WHEN `category` = 'vehicle' THEN 'maintenance'
    WHEN `category` = 'health' THEN 'medical'
    WHEN `category` = 'personal_care' THEN 'grooming'
    WHEN `category` = 'education' THEN 'courses'
    WHEN `category` = 'shopping' THEN 'other_goods'
    WHEN `category` = 'entertainment' THEN 'events'
    WHEN `category` = 'subscriptions' THEN 'software'
    WHEN `category` IN ('family', 'pets') THEN 'caregiving'
    WHEN `category` = 'gifts' THEN 'cash_gifts'
    WHEN `category` = 'insurance' THEN 'insurance'
    WHEN `category` = 'taxes' THEN 'taxes'
    WHEN `category` = 'financial' THEN 'bank_fees'
    ELSE 'unknown'
  END,
  `category` = CASE
    WHEN `kind` = 'income' AND (`category` IN ('salary', 'income') OR lower(`description`) LIKE '%salary%') THEN 'employment'
    WHEN `kind` = 'income' AND `category` = 'freelance' THEN 'business'
    WHEN `kind` = 'income' AND `category` = 'investment_income' THEN 'investments'
    WHEN `kind` = 'income' AND `category` = 'refund' THEN 'refunds'
    WHEN `kind` = 'income' AND `category` = 'gift_income' THEN 'support'
    WHEN `kind` = 'income' THEN 'other_income'
    WHEN `description` = '?' THEN 'other'
    WHEN `subcategory` = 'visa_fees' OR lower(`description`) LIKE '% tax' OR lower(`description`) LIKE '% tax %' OR lower(`description`) = 'uk eta' OR lower(`description`) LIKE '%issue fee%' THEN 'finance'
    WHEN lower(`description`) GLOB '*hotel*' OR lower(`description`) GLOB '*hostel*' OR lower(`description`) GLOB '*airbnb*' OR lower(`description`) GLOB '*apartments*' THEN 'housing'
    WHEN lower(`description`) IN ('dinner', 'lunch', 'breakfast', 'seoul lunch', 'lucnh', 'hamburger') OR lower(`description`) GLOB '*coffee*' OR lower(`description`) = 'cafe' OR lower(`description`) GLOB '*dessert*' OR lower(`description`) GLOB '*gelato*' OR lower(`description`) GLOB '*ice cream*' OR lower(`description`) GLOB '*icecream*' OR lower(`description`) GLOB '*egg tart*' OR lower(`description`) GLOB '*beer*' OR lower(`description`) GLOB '*wine*' OR lower(`description`) = 'alcohol' THEN 'food'
    WHEN lower(`description`) GLOB '*taxi*' OR lower(`description`) GLOB '*flight*' OR lower(`description`) GLOB '*bus*' OR lower(`description`) GLOB '*metro*' OR lower(`description`) GLOB '*train*' OR lower(`description`) GLOB '*tram*' OR lower(`description`) GLOB '*ferry*' OR lower(`description`) GLOB '*transit*' OR lower(`description`) GLOB '*rail europe*' OR lower(`description`) GLOB '*gas fee*' OR lower(`description`) GLOB '*fuel*' OR lower(`description`) GLOB '*parking*' OR lower(`description`) GLOB '*toll*' OR (lower(`description`) GLOB '*rental*' AND (lower(`description`) GLOB '*bike*' OR lower(`description`) GLOB '*bicycle*' OR lower(`description`) GLOB '*scooter*' OR lower(`description`) GLOB '*motorbike*')) THEN 'transport'
    WHEN `subcategory` = 'travel_activities' OR `subcategory` = 'movies_events' OR lower(`description`) GLOB '*ticket*' OR lower(`description`) GLOB '*attraction*' OR lower(`description`) GLOB '*opera*' OR lower(`description`) GLOB '*tour*' OR lower(`description`) GLOB '*balloon*' OR lower(`description`) GLOB '*halloween*' OR lower(`description`) GLOB '*wine tasting*' THEN 'leisure'
    WHEN lower(`description`) GLOB '*cigarette*' OR lower(`description`) = 'lighter' OR lower(`description`) GLOB '*face wash*' OR lower(`description`) GLOB '*sun block*' OR lower(`description`) GLOB '*lotion*' OR lower(`description`) GLOB '*balm*' OR lower(`description`) IN ('jacket', 'clothes', 'purchase of pants', 'slippers', 'socks', 'towel', 'towel purchase', 'vynil') THEN 'shopping'
    WHEN lower(`description`) GLOB '*laundry*' THEN 'other'
    WHEN lower(`description`) GLOB '*haircut*' OR lower(`description`) GLOB '*barbershop*' THEN 'care'
    WHEN lower(`description`) GLOB '*youtube*' THEN 'leisure'
    WHEN lower(`description`) GLOB '*esim*' OR lower(`description`) GLOB '*mobile data*' OR lower(`description`) GLOB '*mobile dater*' THEN 'digital'
    WHEN `subcategory` IN ('furniture', 'household_supplies', 'skincare', 'pet_food') THEN 'shopping'
    WHEN `subcategory` = 'school_support' THEN 'education'
    WHEN `subcategory` = 'postal_services' THEN 'other'
    WHEN `category` IN ('housing', 'utilities') THEN 'housing'
    WHEN `category` IN ('groceries', 'dining') THEN 'food'
    WHEN `category` IN ('transport', 'vehicle') THEN 'transport'
    WHEN `category` = 'travel' THEN CASE WHEN `subcategory` = 'accommodation' THEN 'housing' WHEN `subcategory` = 'visa_fees' THEN 'finance' WHEN `subcategory` = 'travel_activities' THEN 'leisure' ELSE 'transport' END
    WHEN `category` IN ('health', 'personal_care', 'family', 'pets') THEN 'care'
    WHEN `category` = 'education' THEN 'education'
    WHEN `category` = 'shopping' THEN 'shopping'
    WHEN `category` = 'entertainment' THEN 'leisure'
    WHEN `category` IN ('communication', 'subscriptions') THEN CASE WHEN `subcategory` = 'media_streaming' THEN 'leisure' ELSE 'digital' END
    WHEN `category` IN ('insurance', 'taxes', 'financial') THEN 'finance'
    WHEN `category` = 'gifts' THEN 'giving'
    ELSE 'other'
  END,
  `category_version` = 2,
  `classification_source` = 'legacy',
  `classification_confidence` = NULL;--> statement-breakpoint

ALTER TABLE `recurring_series` ADD COLUMN `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_series` ADD COLUMN `category_version` integer DEFAULT 2 NOT NULL CHECK (`category_version` = 2);--> statement-breakpoint
ALTER TABLE `recurring_series` ADD COLUMN `classification_source` text DEFAULT 'manual' NOT NULL CHECK (`classification_source` IN ('legacy', 'rule', 'ai', 'manual', 'fallback'));--> statement-breakpoint
ALTER TABLE `recurring_series` ADD COLUMN `classification_confidence` integer CHECK (`classification_confidence` IS NULL OR `classification_confidence` BETWEEN 0 AND 100);--> statement-breakpoint

UPDATE `recurring_series`
SET
  `tags` = CASE WHEN `category` = 'travel' THEN '["travel"]' WHEN `category` = 'pets' THEN '["pet"]' WHEN `category` = 'family' THEN '["family"]' WHEN `category` = 'gifts' THEN '["gift"]' ELSE '[]' END,
  `subcategory` = CASE
    WHEN `kind` = 'income' AND `category` IN ('salary', 'income') THEN CASE `subcategory` WHEN 'bonus' THEN 'bonus' WHEN 'allowance' THEN 'allowance' ELSE 'salary' END
    WHEN `kind` = 'income' AND `category` = 'freelance' THEN CASE `subcategory` WHEN 'consulting' THEN 'consulting' WHEN 'business_sales' THEN 'sales' ELSE 'freelance' END
    WHEN `kind` = 'income' AND `category` = 'investment_income' THEN CASE `subcategory` WHEN 'dividends' THEN 'dividends' WHEN 'capital_gains' THEN 'gains' ELSE 'investment_interest' END
    WHEN `kind` = 'income' AND `category` = 'refund' THEN CASE `subcategory` WHEN 'tax_refund' THEN 'tax_refund' WHEN 'reimbursement' THEN 'reimbursement' ELSE 'purchase_refund' END
    WHEN `kind` = 'income' AND `category` = 'gift_income' THEN CASE `subcategory` WHEN 'family_support' THEN 'family_support' ELSE 'gifts_received' END
    WHEN `kind` = 'income' THEN 'unknown_income'
    WHEN `subcategory` = 'rent_mortgage' THEN 'rent' WHEN `subcategory` = 'accommodation' THEN 'lodging' WHEN `subcategory` IN ('electricity_gas', 'water', 'waste_management') THEN 'utilities' WHEN `subcategory` = 'home_maintenance' THEN 'repairs'
    WHEN `subcategory` IN ('restaurant', 'delivery_takeout') THEN 'meals' WHEN `subcategory` = 'cafe' THEN 'cafe' WHEN `category` = 'groceries' THEN 'groceries'
    WHEN `subcategory` IN ('bus_subway', 'rail', 'travel_transport') THEN 'transit' WHEN `subcategory` = 'taxi_rideshare' THEN 'taxi' WHEN `subcategory` = 'flights' THEN 'flights' WHEN `subcategory` = 'fuel' THEN 'fuel' WHEN `subcategory` = 'parking_tolls' THEN 'parking' WHEN `subcategory` = 'vehicle_maintenance' THEN 'maintenance'
    WHEN `subcategory` = 'clinic_hospital' THEN 'medical' WHEN `subcategory` = 'pharmacy' THEN 'pharmacy' WHEN `subcategory` = 'dental' THEN 'dental' WHEN `subcategory` = 'vision' THEN 'vision' WHEN `subcategory` IN ('fitness', 'spa_wellness') THEN 'fitness' WHEN `subcategory` IN ('hair_beauty', 'pet_grooming') THEN 'grooming' WHEN `subcategory` IN ('childcare', 'eldercare') THEN 'caregiving' WHEN `subcategory` = 'veterinary' THEN 'vet'
    WHEN `subcategory` = 'tuition' THEN 'tuition' WHEN `subcategory` IN ('books_supplies', 'school_support') THEN 'materials' WHEN `subcategory` = 'online_courses' THEN 'courses'
    WHEN `subcategory` = 'clothing' THEN 'clothing' WHEN `subcategory` = 'electronics' THEN 'electronics' WHEN `subcategory` IN ('home_goods', 'furniture') THEN 'home_goods' WHEN `subcategory` = 'household_supplies' THEN 'essentials' WHEN `subcategory` = 'skincare' THEN 'toiletries' WHEN `subcategory` = 'pet_food' THEN 'pet_supplies'
    WHEN `subcategory` IN ('movies_events', 'travel_activities') THEN 'events' WHEN `subcategory` = 'games' THEN 'games' WHEN `subcategory` = 'hobbies' THEN 'hobbies' WHEN `subcategory` = 'media_streaming' THEN 'streaming'
    WHEN `subcategory` = 'mobile_phone' THEN 'mobile' WHEN `subcategory` = 'internet' THEN 'internet' WHEN `subcategory` = 'software' THEN 'software'
    WHEN `category` = 'insurance' THEN 'insurance' WHEN `category` = 'taxes' THEN 'taxes' WHEN `subcategory` IN ('bank_fees', 'card_fees') THEN 'bank_fees' WHEN `subcategory` = 'loan_interest' THEN 'interest' WHEN `subcategory` IN ('government_fees', 'visa_fees') THEN 'government_fees'
    WHEN `subcategory` = 'donations' THEN 'donations' WHEN `category` = 'gifts' THEN 'cash_gifts'
    ELSE 'unknown'
  END,
  `category` = CASE
    WHEN `kind` = 'income' AND `category` IN ('salary', 'income') THEN 'employment' WHEN `kind` = 'income' AND `category` = 'freelance' THEN 'business' WHEN `kind` = 'income' AND `category` = 'investment_income' THEN 'investments' WHEN `kind` = 'income' AND `category` = 'refund' THEN 'refunds' WHEN `kind` = 'income' AND `category` = 'gift_income' THEN 'support' WHEN `kind` = 'income' THEN 'other_income'
    WHEN `subcategory` IN ('furniture', 'household_supplies', 'skincare', 'pet_food') THEN 'shopping' WHEN `subcategory` = 'school_support' THEN 'education' WHEN `subcategory` = 'postal_services' THEN 'other'
    WHEN `category` IN ('housing', 'utilities') THEN 'housing' WHEN `category` IN ('groceries', 'dining') THEN 'food' WHEN `category` IN ('transport', 'vehicle') THEN 'transport'
    WHEN `category` = 'travel' THEN CASE WHEN `subcategory` = 'accommodation' THEN 'housing' WHEN `subcategory` = 'visa_fees' THEN 'finance' WHEN `subcategory` = 'travel_activities' THEN 'leisure' ELSE 'transport' END
    WHEN `category` IN ('health', 'personal_care', 'family', 'pets') THEN 'care' WHEN `category` = 'education' THEN 'education' WHEN `category` = 'shopping' THEN 'shopping' WHEN `category` = 'entertainment' THEN 'leisure' WHEN `category` IN ('communication', 'subscriptions') THEN CASE WHEN `subcategory` = 'media_streaming' THEN 'leisure' ELSE 'digital' END WHEN `category` IN ('insurance', 'taxes', 'financial') THEN 'finance' WHEN `category` = 'gifts' THEN 'giving' ELSE 'other'
  END,
  `classification_source` = 'legacy';--> statement-breakpoint

CREATE TABLE `__new_monthly_budgets` (
  `owner_id` text NOT NULL,
  `month` text NOT NULL,
  `category` text NOT NULL,
  `amount_usd_minor` integer NOT NULL,
  `created_at_ms` integer NOT NULL,
  `updated_at_ms` integer NOT NULL,
  PRIMARY KEY(`owner_id`, `month`, `category`),
  FOREIGN KEY (`owner_id`) REFERENCES `user_states`(`owner_id`) ON DELETE cascade,
  CONSTRAINT `monthly_budgets_month_shape` CHECK(length(`month`) = 7 AND `month` GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  CONSTRAINT `monthly_budgets_category_supported` CHECK(`category` IN ('housing', 'food', 'transport', 'care', 'education', 'shopping', 'leisure', 'digital', 'finance', 'giving', 'other')),
  CONSTRAINT `monthly_budgets_amount_range` CHECK(`amount_usd_minor` > 0 AND `amount_usd_minor` <= 9000000000000),
  CONSTRAINT `monthly_budgets_timestamps` CHECK(`created_at_ms` > 0 AND `updated_at_ms` >= `created_at_ms`)
);--> statement-breakpoint
INSERT INTO `__new_monthly_budgets` (`owner_id`, `month`, `category`, `amount_usd_minor`, `created_at_ms`, `updated_at_ms`)
SELECT
  `owner_id`,
  `month`,
  CASE
    WHEN `category` IN ('housing', 'utilities') THEN 'housing'
    WHEN `category` IN ('groceries', 'dining') THEN 'food'
    WHEN `category` IN ('transport', 'vehicle', 'travel') THEN 'transport'
    WHEN `category` IN ('health', 'personal_care', 'family', 'pets') THEN 'care'
    WHEN `category` = 'education' THEN 'education'
    WHEN `category` = 'shopping' THEN 'shopping'
    WHEN `category` = 'entertainment' THEN 'leisure'
    WHEN `category` IN ('communication', 'subscriptions') THEN 'digital'
    WHEN `category` IN ('insurance', 'taxes', 'financial') THEN 'finance'
    WHEN `category` = 'gifts' THEN 'giving'
    ELSE 'other'
  END,
  SUM(`amount_usd_minor`),
  MIN(`created_at_ms`),
  MAX(`updated_at_ms`)
FROM `monthly_budgets`
GROUP BY `owner_id`, `month`, 3;--> statement-breakpoint
DROP TABLE `monthly_budgets`;--> statement-breakpoint
ALTER TABLE `__new_monthly_budgets` RENAME TO `monthly_budgets`;--> statement-breakpoint
CREATE INDEX `idx_monthly_budgets_owner_month` ON `monthly_budgets` (`owner_id`,`month`);--> statement-breakpoint

PRAGMA foreign_keys=ON;

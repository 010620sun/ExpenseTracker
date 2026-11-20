-- Laundry is a service, not personal care. Migration 0015 already contains
-- this rule for fresh databases; this patch corrects databases that applied
-- the initial migration before the edge case was found.
UPDATE `transactions`
SET `category` = 'other'
WHERE `category` = 'care' AND `subcategory` = 'laundry';

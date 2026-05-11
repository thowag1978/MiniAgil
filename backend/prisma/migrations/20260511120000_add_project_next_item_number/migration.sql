-- AlterTable
ALTER TABLE `projects` ADD COLUMN `next_item_number` INTEGER NOT NULL DEFAULT 1;

-- Backfill existing projects so new item keys continue after the highest existing numeric suffix.
UPDATE `projects` p
SET `next_item_number` = COALESCE((
  SELECT MAX(CAST(SUBSTRING(i.`project_key`, CHAR_LENGTH(p.`key_prefix`) + 2) AS UNSIGNED)) + 1
  FROM `items` i
  WHERE i.`project_id` = p.`id`
    AND LEFT(i.`project_key`, CHAR_LENGTH(p.`key_prefix`) + 1) = CONCAT(p.`key_prefix`, '-')
), 1);

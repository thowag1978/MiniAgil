ALTER TABLE `items`
  ADD COLUMN `backlog_position` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `story_points` INTEGER NULL;

-- Preserve the closest existing ordering without assigning estimate semantics to story points.
UPDATE `items` SET `backlog_position` = `board_position`;

CREATE INDEX `items_project_id_backlog_position_idx` ON `items`(`project_id`, `backlog_position`);

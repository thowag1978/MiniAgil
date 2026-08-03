ALTER TABLE `items`
  ADD COLUMN `board_position` DOUBLE NOT NULL DEFAULT 0;

UPDATE `items` AS item
INNER JOIN (
  SELECT `id`, ROW_NUMBER() OVER (
    PARTITION BY `workflow_status_id`
    ORDER BY `createdAt` ASC, `id` ASC
  ) * 1024 AS normalized_position
  FROM `items`
) AS ordered ON ordered.id = item.id
SET item.board_position = ordered.normalized_position;

CREATE INDEX `items_workflow_status_id_board_position_idx`
  ON `items`(`workflow_status_id`, `board_position`);

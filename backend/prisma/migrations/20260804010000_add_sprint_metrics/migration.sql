ALTER TABLE `sprints`
  ADD COLUMN `initial_scope_points` INTEGER NULL,
  ADD COLUMN `initial_scope_items` INTEGER NULL,
  ADD COLUMN `scopeCapturedAt` DATETIME(3) NULL;

CREATE TABLE `sprint_scope_changes` (
  `id` VARCHAR(191) NOT NULL, `sprint_id` VARCHAR(191) NOT NULL, `item_id` VARCHAR(191) NULL,
  `user_id` VARCHAR(191) NOT NULL, `change_type` ENUM('ADDED','REMOVED') NOT NULL,
  `points` INTEGER NOT NULL, `item_key` VARCHAR(191) NOT NULL, `item_title` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `sprint_scope_changes_sprint_id_createdAt_idx`(`sprint_id`,`createdAt`),
  INDEX `sprint_scope_changes_item_id_idx`(`item_id`), INDEX `sprint_scope_changes_user_id_idx`(`user_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sprint_snapshots` (
  `id` VARCHAR(191) NOT NULL, `sprint_id` VARCHAR(191) NOT NULL, `snapshot_date` DATE NOT NULL,
  `scope_points` INTEGER NOT NULL, `remaining_points` INTEGER NOT NULL, `completed_points` INTEGER NOT NULL,
  `added_points` INTEGER NOT NULL, `removed_points` INTEGER NOT NULL,
  `total_items` INTEGER NOT NULL, `completed_items` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `sprint_snapshots_sprint_id_snapshot_date_key`(`sprint_id`,`snapshot_date`),
  INDEX `sprint_snapshots_sprint_id_snapshot_date_idx`(`sprint_id`,`snapshot_date`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sprint_scope_changes` ADD CONSTRAINT `sprint_scope_changes_sprint_id_fkey` FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sprint_scope_changes` ADD CONSTRAINT `sprint_scope_changes_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sprint_scope_changes` ADD CONSTRAINT `sprint_scope_changes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sprint_snapshots` ADD CONSTRAINT `sprint_snapshots_sprint_id_fkey` FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

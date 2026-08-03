-- Expand the enum before converting legacy CLOSED rows.
ALTER TABLE `sprints` MODIFY `status` ENUM('PLANNED','ACTIVE','CLOSED','FINISHED','CANCELLED') NOT NULL DEFAULT 'PLANNED';
UPDATE `sprints` SET `status` = 'FINISHED' WHERE `status` = 'CLOSED';
ALTER TABLE `sprints` MODIFY `status` ENUM('PLANNED','ACTIVE','FINISHED','CANCELLED') NOT NULL DEFAULT 'PLANNED';

ALTER TABLE `sprints`
  ADD COLUMN `startedAt` DATETIME(3) NULL,
  ADD COLUMN `finishedAt` DATETIME(3) NULL,
  ADD COLUMN `started_by_id` VARCHAR(191) NULL,
  ADD COLUMN `finished_by_id` VARCHAR(191) NULL;

-- Preserve useful audit dates for existing active and finished sprints.
UPDATE `sprints` SET `startedAt` = COALESCE(`startDate`, `updatedAt`) WHERE `status` IN ('ACTIVE','FINISHED');
UPDATE `sprints` SET `finishedAt` = `updatedAt` WHERE `status` = 'FINISHED';

CREATE INDEX `sprints_started_by_id_idx` ON `sprints`(`started_by_id`);
CREATE INDEX `sprints_finished_by_id_idx` ON `sprints`(`finished_by_id`);
ALTER TABLE `sprints` ADD CONSTRAINT `sprints_started_by_id_fkey` FOREIGN KEY (`started_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sprints` ADD CONSTRAINT `sprints_finished_by_id_fkey` FOREIGN KEY (`finished_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

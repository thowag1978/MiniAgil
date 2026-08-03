ALTER TABLE `webhook_deliveries` ADD COLUMN `processingStartedAt` DATETIME(3) NULL;
ALTER TABLE `items` ADD COLUMN `due_date` DATETIME(3) NULL, ADD INDEX `items_project_id_due_date_idx` (`project_id`, `due_date`);
CREATE TABLE `domain_event_outbox` (
  `id` VARCHAR(191) NOT NULL, `event_id` VARCHAR(191) NOT NULL, `event_type` VARCHAR(191) NOT NULL, `payload` JSON NOT NULL,
  `status` ENUM('PENDING','PROCESSING','PUBLISHED','RETRYING','FAILED') NOT NULL DEFAULT 'PENDING', `attempt_count` INTEGER NOT NULL DEFAULT 0,
  `nextAttemptAt` DATETIME(3) NULL, `processingStartedAt` DATETIME(3) NULL, `publishedAt` DATETIME(3) NULL, `last_error` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `domain_event_outbox_event_id_key`(`event_id`), INDEX `domain_event_outbox_status_nextAttemptAt_idx`(`status`,`nextAttemptAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

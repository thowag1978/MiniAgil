CREATE TABLE `webhooks` (
  `id` VARCHAR(191) NOT NULL, `project_id` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL,
  `url` TEXT NOT NULL, `secret_encrypted` TEXT NOT NULL, `events` JSON NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `webhooks_project_id_name_key`(`project_id`,`name`), INDEX `webhooks_project_id_is_active_idx`(`project_id`,`is_active`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `webhook_deliveries` (
  `id` VARCHAR(191) NOT NULL, `webhook_id` VARCHAR(191) NOT NULL, `event_id` VARCHAR(191) NOT NULL, `event_type` VARCHAR(191) NOT NULL,
  `payload` JSON NOT NULL, `status` ENUM('PENDING','PROCESSING','SUCCEEDED','RETRYING','FAILED') NOT NULL DEFAULT 'PENDING',
  `attempt_count` INTEGER NOT NULL DEFAULT 0, `response_status` INTEGER NULL, `response_body` TEXT NULL, `last_error` TEXT NULL,
  `nextAttemptAt` DATETIME(3) NULL, `deliveredAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `webhook_deliveries_webhook_id_event_id_key`(`webhook_id`,`event_id`), INDEX `webhook_deliveries_status_nextAttemptAt_idx`(`status`,`nextAttemptAt`), INDEX `webhook_deliveries_webhook_id_createdAt_idx`(`webhook_id`,`createdAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `webhooks` ADD CONSTRAINT `webhooks_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `webhook_deliveries` ADD CONSTRAINT `webhook_deliveries_webhook_id_fkey` FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

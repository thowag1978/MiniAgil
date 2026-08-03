CREATE TABLE `bug_details` (
  `id` VARCHAR(191) NOT NULL,
  `item_id` VARCHAR(191) NOT NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'BLOCKER') NOT NULL DEFAULT 'MEDIUM',
  `environment` ENUM('DEVELOPMENT', 'TEST', 'HOMOLOGATION', 'PRODUCTION') NOT NULL DEFAULT 'TEST',
  `origin` ENUM('DEVELOPMENT', 'TEST', 'HOMOLOGATION', 'PRODUCTION', 'CUSTOMER', 'AUDIT', 'MONITORING') NOT NULL DEFAULT 'DEVELOPMENT',
  `reproducibility` ENUM('ALWAYS', 'INTERMITTENT', 'ONCE', 'NOT_REPRODUCED') NOT NULL DEFAULT 'NOT_REPRODUCED',
  `reproduction_steps` TEXT NULL,
  `expected_result` TEXT NULL,
  `actual_result` TEXT NULL,
  `technical_analysis` TEXT NULL,
  `root_cause` TEXT NULL,
  `resolution` TEXT NULL,
  `regression` BOOLEAN NOT NULL DEFAULT false,
  `reopened_count` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `bug_details_item_id_key`(`item_id`),
  INDEX `bug_details_severity_idx`(`severity`),
  INDEX `bug_details_environment_idx`(`environment`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `bug_details` (
  `id`, `item_id`, `severity`, `environment`, `origin`, `reproducibility`,
  `regression`, `reopened_count`, `createdAt`, `updatedAt`
)
SELECT UUID(), item.id, 'MEDIUM', 'TEST', 'DEVELOPMENT', 'NOT_REPRODUCED', false, 0, NOW(3), NOW(3)
FROM `items` AS item
WHERE item.type = 'BUG';

ALTER TABLE `bug_details`
  ADD CONSTRAINT `bug_details_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

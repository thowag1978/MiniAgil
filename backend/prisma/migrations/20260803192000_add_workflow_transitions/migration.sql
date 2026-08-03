CREATE TABLE `workflow_transitions` (
  `id` VARCHAR(191) NOT NULL,
  `workflow_id` VARCHAR(191) NOT NULL,
  `from_status_id` VARCHAR(191) NOT NULL,
  `to_status_id` VARCHAR(191) NOT NULL,
  `allowed_role` ENUM('OWNER', 'ADMIN', 'MEMBER', 'VIEWER') NULL,
  `requires_comment` BOOLEAN NOT NULL DEFAULT false,
  `requires_assignee` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `workflow_transitions_workflow_id_is_active_idx`(`workflow_id`, `is_active`),
  INDEX `workflow_transitions_from_status_id_to_status_id_idx`(`from_status_id`, `to_status_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `workflow_transitions`
  ADD CONSTRAINT `workflow_transitions_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `workflow_transitions_from_status_id_fkey` FOREIGN KEY (`from_status_id`) REFERENCES `workflow_statuses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `workflow_transitions_to_status_id_fkey` FOREIGN KEY (`to_status_id`) REFERENCES `workflow_statuses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

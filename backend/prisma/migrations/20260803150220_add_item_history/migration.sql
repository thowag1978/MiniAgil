-- CreateTable
CREATE TABLE `item_history` (
    `id` VARCHAR(191) NOT NULL,
    `item_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `event_type` ENUM('ITEM_CREATED', 'TITLE_CHANGED', 'DESCRIPTION_CHANGED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNEE_CHANGED', 'SPRINT_CHANGED', 'ESTIMATE_CHANGED', 'ACCEPTANCE_CRITERIA_CHANGED', 'COMMENT_CREATED', 'COMMENT_EDITED', 'COMMENT_DELETED') NOT NULL,
    `field` VARCHAR(191) NULL,
    `old_value` JSON NULL,
    `new_value` JSON NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `item_history_item_id_createdAt_idx`(`item_id`, `createdAt`),
    INDEX `item_history_project_id_idx`(`project_id`),
    INDEX `item_history_user_id_idx`(`user_id`),
    INDEX `item_history_event_type_idx`(`event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `item_history` ADD CONSTRAINT `item_history_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_history` ADD CONSTRAINT `item_history_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_history` ADD CONSTRAINT `item_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

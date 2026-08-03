-- AlterTable
ALTER TABLE `item_history` MODIFY `event_type` ENUM('ITEM_CREATED', 'TITLE_CHANGED', 'DESCRIPTION_CHANGED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNEE_CHANGED', 'SPRINT_CHANGED', 'ESTIMATE_CHANGED', 'ACCEPTANCE_CRITERIA_CHANGED', 'COMMENT_CREATED', 'COMMENT_EDITED', 'COMMENT_DELETED', 'ATTACHMENT_UPLOADED', 'ATTACHMENT_DOWNLOADED', 'ATTACHMENT_DELETED', 'WATCHER_ADDED', 'WATCHER_REMOVED') NOT NULL;

-- CreateTable
CREATE TABLE `item_watchers` (
    `id` VARCHAR(191) NOT NULL,
    `item_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `item_watchers_user_id_idx`(`user_id`),
    UNIQUE INDEX `item_watchers_item_id_user_id_key`(`item_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `item_id` VARCHAR(191) NOT NULL,
    `history_id` VARCHAR(191) NULL,
    `type` ENUM('ITEM_ASSIGNED', 'COMMENT_CREATED', 'STATUS_CHANGED', 'DUE_DATE_CHANGED', 'WATCHER_ADDED') NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_readAt_createdAt_idx`(`user_id`, `readAt`, `createdAt`),
    INDEX `notifications_project_id_idx`(`project_id`),
    INDEX `notifications_item_id_idx`(`item_id`),
    INDEX `notifications_history_id_idx`(`history_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `item_watchers` ADD CONSTRAINT `item_watchers_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_watchers` ADD CONSTRAINT `item_watchers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_history_id_fkey` FOREIGN KEY (`history_id`) REFERENCES `item_history`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

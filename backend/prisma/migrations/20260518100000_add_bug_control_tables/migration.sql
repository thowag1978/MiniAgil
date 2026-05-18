-- CreateTable
CREATE TABLE `bug_systems` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bug_systems_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bug_features` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `system_id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bug_features_system_id_idx`(`system_id`),
    UNIQUE INDEX `bug_features_system_id_name_key`(`system_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bugs` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `stepsToReproduce` TEXT NULL,
    `expectedResult` TEXT NULL,
    `actualResult` TEXT NULL,
    `status` ENUM('OPEN', 'TRIAGE', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED') NOT NULL DEFAULT 'OPEN',
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `system_id` VARCHAR(191) NOT NULL,
    `feature_id` VARCHAR(191) NULL,
    `reporter_id` VARCHAR(191) NOT NULL,
    `assignee_id` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `bugs_system_id_idx`(`system_id`),
    INDEX `bugs_feature_id_idx`(`feature_id`),
    INDEX `bugs_reporter_id_idx`(`reporter_id`),
    INDEX `bugs_assignee_id_idx`(`assignee_id`),
    INDEX `bugs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bug_comments` (
    `id` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `bug_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bug_comments_bug_id_idx`(`bug_id`),
    INDEX `bug_comments_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bug_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `s3_url` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `bug_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bug_attachments_bug_id_idx`(`bug_id`),
    INDEX `bug_attachments_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bug_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `bug_id` VARCHAR(191) NOT NULL,
    `from_status` ENUM('OPEN', 'TRIAGE', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED') NULL,
    `to_status` ENUM('OPEN', 'TRIAGE', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED') NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bug_status_history_bug_id_idx`(`bug_id`),
    INDEX `bug_status_history_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bug_features` ADD CONSTRAINT `bug_features_system_id_fkey` FOREIGN KEY (`system_id`) REFERENCES `bug_systems`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bugs` ADD CONSTRAINT `bugs_system_id_fkey` FOREIGN KEY (`system_id`) REFERENCES `bug_systems`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bugs` ADD CONSTRAINT `bugs_feature_id_fkey` FOREIGN KEY (`feature_id`) REFERENCES `bug_features`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bugs` ADD CONSTRAINT `bugs_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bugs` ADD CONSTRAINT `bugs_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bug_comments` ADD CONSTRAINT `bug_comments_bug_id_fkey` FOREIGN KEY (`bug_id`) REFERENCES `bugs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bug_comments` ADD CONSTRAINT `bug_comments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bug_attachments` ADD CONSTRAINT `bug_attachments_bug_id_fkey` FOREIGN KEY (`bug_id`) REFERENCES `bugs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bug_attachments` ADD CONSTRAINT `bug_attachments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bug_status_history` ADD CONSTRAINT `bug_status_history_bug_id_fkey` FOREIGN KEY (`bug_id`) REFERENCES `bugs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bug_status_history` ADD CONSTRAINT `bug_status_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `project_repositories` (
  `id` VARCHAR(191) NOT NULL, `project_id` VARCHAR(191) NOT NULL, `owner` VARCHAR(191) NOT NULL, `repository` VARCHAR(191) NOT NULL,
  `default_branch` VARCHAR(191) NOT NULL DEFAULT 'main', `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `project_repositories_project_id_owner_repository_key`(`project_id`,`owner`,`repository`), INDEX `project_repositories_project_id_idx`(`project_id`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `item_code_links` (
  `id` VARCHAR(191) NOT NULL, `item_id` VARCHAR(191) NOT NULL, `repository_id` VARCHAR(191) NOT NULL, `created_by_id` VARCHAR(191) NOT NULL,
  `link_type` ENUM('ISSUE','PULL_REQUEST','COMMIT','BRANCH') NOT NULL, `external_number` INTEGER NULL, `url` TEXT NOT NULL, `branch` VARCHAR(191) NULL, `state` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  INDEX `item_code_links_item_id_idx`(`item_id`), INDEX `item_code_links_repository_id_idx`(`repository_id`), INDEX `item_code_links_created_by_id_idx`(`created_by_id`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `project_repositories` ADD CONSTRAINT `project_repositories_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_code_links` ADD CONSTRAINT `item_code_links_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_code_links` ADD CONSTRAINT `item_code_links_repository_id_fkey` FOREIGN KEY (`repository_id`) REFERENCES `project_repositories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_code_links` ADD CONSTRAINT `item_code_links_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

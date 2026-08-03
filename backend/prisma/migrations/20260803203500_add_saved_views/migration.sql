CREATE TABLE `saved_views` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `project_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `view_type` ENUM('KANBAN') NOT NULL DEFAULT 'KANBAN',
  `filters` JSON NOT NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `saved_views_user_id_project_id_view_type_name_key`(`user_id`, `project_id`, `view_type`, `name`),
  INDEX `saved_views_user_id_project_id_view_type_is_default_idx`(`user_id`, `project_id`, `view_type`, `is_default`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `saved_views`
  ADD CONSTRAINT `saved_views_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `saved_views_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `custom_fields` (
  `id` VARCHAR(191) NOT NULL, `project_id` VARCHAR(191) NOT NULL,
  `item_type` ENUM('EPIC','STORY','TASK','SUBTASK','BUG') NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `field_type` ENUM('TEXT','LONG_TEXT','NUMBER','DATE','BOOLEAN','SELECT','MULTISELECT','USER','URL') NOT NULL,
  `is_required` BOOLEAN NOT NULL DEFAULT false, `position` INTEGER NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true, `show_on_card` BOOLEAN NOT NULL DEFAULT false,
  `use_in_filters` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `custom_fields_project_id_item_type_name_key`(`project_id`,`item_type`,`name`),
  INDEX `custom_fields_project_id_item_type_is_active_position_idx`(`project_id`,`item_type`,`is_active`,`position`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `custom_field_options` (
  `id` VARCHAR(191) NOT NULL, `field_id` VARCHAR(191) NOT NULL, `label` VARCHAR(191) NOT NULL,
  `value` VARCHAR(191) NOT NULL, `position` INTEGER NOT NULL DEFAULT 0, `is_active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `custom_field_options_field_id_value_key`(`field_id`,`value`),
  INDEX `custom_field_options_field_id_is_active_position_idx`(`field_id`,`is_active`,`position`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `custom_field_values` (
  `id` VARCHAR(191) NOT NULL, `item_id` VARCHAR(191) NOT NULL, `field_id` VARCHAR(191) NOT NULL,
  `value` JSON NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `custom_field_values_item_id_field_id_key`(`item_id`,`field_id`), INDEX `custom_field_values_field_id_idx`(`field_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `custom_fields` ADD CONSTRAINT `custom_fields_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `custom_field_options` ADD CONSTRAINT `custom_field_options_field_id_fkey` FOREIGN KEY (`field_id`) REFERENCES `custom_fields`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `custom_field_values` ADD CONSTRAINT `custom_field_values_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `custom_field_values` ADD CONSTRAINT `custom_field_values_field_id_fkey` FOREIGN KEY (`field_id`) REFERENCES `custom_fields`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

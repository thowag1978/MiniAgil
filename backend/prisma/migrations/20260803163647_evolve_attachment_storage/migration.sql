-- AlterTable
ALTER TABLE `attachments` ADD COLUMN `bucket` VARCHAR(191) NULL,
    ADD COLUMN `checksum` VARCHAR(191) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `mime_type` VARCHAR(191) NULL,
    ADD COLUMN `object_key` VARCHAR(191) NULL,
    ADD COLUMN `original_name` VARCHAR(191) NULL,
    ADD COLUMN `size_bytes` BIGINT NULL,
    ADD COLUMN `user_id` VARCHAR(191) NULL,
    MODIFY `s3_url` VARCHAR(191) NULL,
    MODIFY `fileName` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `attachments_user_id_idx` ON `attachments`(`user_id`);

-- CreateIndex
CREATE INDEX `attachments_bucket_object_key_idx` ON `attachments`(`bucket`, `object_key`);

-- CreateIndex
CREATE INDEX `attachments_deletedAt_idx` ON `attachments`(`deletedAt`);

-- AddForeignKey
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

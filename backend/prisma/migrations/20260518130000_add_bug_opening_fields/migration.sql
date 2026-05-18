-- AlterTable
ALTER TABLE `bugs`
    ADD COLUMN `protocol` VARCHAR(191) NOT NULL,
    ADD COLUMN `environment` VARCHAR(191) NULL,
    ADD COLUMN `browserDevice` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `bugs_protocol_key` ON `bugs`(`protocol`);

-- Remove only the global name constraint; names remain unique inside each workflow.
DROP INDEX `workflow_statuses_name_key` ON `workflow_statuses`;

ALTER TABLE `workflow_statuses` ADD COLUMN `category` ENUM('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'TODO',
    ADD COLUMN `color` VARCHAR(191) NOT NULL DEFAULT '#64748B',
    ADD COLUMN `is_final` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is_initial` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `position` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `wip_limit` INTEGER NULL,
    ADD COLUMN `workflow_id` VARCHAR(191) NULL;

CREATE TABLE `workflows` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `item_type` ENUM('EPIC', 'STORY', 'TASK', 'SUBTASK', 'BUG') NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `workflows_project_id_item_type_is_default_idx`(`project_id`, `item_type`, `is_default`),
    UNIQUE INDEX `workflows_project_id_item_type_name_key`(`project_id`, `item_type`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `workflow_statuses_workflow_id_position_idx` ON `workflow_statuses`(`workflow_id`, `position`);
CREATE UNIQUE INDEX `workflow_statuses_workflow_id_name_key` ON `workflow_statuses`(`workflow_id`, `name`);

ALTER TABLE `workflows` ADD CONSTRAINT `workflows_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `workflow_statuses` ADD CONSTRAINT `workflow_statuses_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing project receives an independent default workflow for every item type.
INSERT INTO `workflows` (`id`, `name`, `project_id`, `item_type`, `is_default`, `createdAt`, `updatedAt`)
SELECT UUID(), CONCAT('Workflow padrão - ', item_types.item_type), projects.id, item_types.item_type, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `projects`
CROSS JOIN (
    SELECT 'EPIC' AS item_type
    UNION ALL SELECT 'STORY'
    UNION ALL SELECT 'TASK'
    UNION ALL SELECT 'SUBTASK'
    UNION ALL SELECT 'BUG'
) AS item_types;

-- Clone legacy definitions into each workflow. Legacy rows are deliberately retained.
INSERT INTO `workflow_statuses`
    (`id`, `name`, `order`, `workflow_id`, `category`, `color`, `position`, `is_initial`, `is_final`, `wip_limit`)
SELECT
    UUID(),
    legacy.name,
    legacy.`order`,
    workflows.id,
    CASE
        WHEN UPPER(legacy.name) LIKE '%CANCEL%' THEN 'CANCELLED'
        WHEN UPPER(legacy.name) LIKE '%CONCLU%' OR UPPER(legacy.name) LIKE '%DONE%' THEN 'DONE'
        WHEN UPPER(legacy.name) LIKE '%REVIS%' OR UPPER(legacy.name) LIKE '%REVIEW%' THEN 'REVIEW'
        WHEN UPPER(legacy.name) LIKE '%PROGRESS%' OR UPPER(legacy.name) LIKE '%ANDAMENTO%' THEN 'IN_PROGRESS'
        WHEN UPPER(legacy.name) LIKE '%BACKLOG%' THEN 'BACKLOG'
        ELSE 'TODO'
    END,
    CASE
        WHEN UPPER(legacy.name) LIKE '%CANCEL%' THEN '#EF4444'
        WHEN UPPER(legacy.name) LIKE '%CONCLU%' OR UPPER(legacy.name) LIKE '%DONE%' THEN '#22C55E'
        WHEN UPPER(legacy.name) LIKE '%REVIS%' OR UPPER(legacy.name) LIKE '%REVIEW%' THEN '#F59E0B'
        WHEN UPPER(legacy.name) LIKE '%PROGRESS%' OR UPPER(legacy.name) LIKE '%ANDAMENTO%' THEN '#3B82F6'
        WHEN UPPER(legacy.name) LIKE '%BACKLOG%' THEN '#94A3B8'
        ELSE '#64748B'
    END,
    legacy.`order`,
    legacy.`order` = (SELECT MIN(first_status.`order`) FROM `workflow_statuses` AS first_status WHERE first_status.workflow_id IS NULL),
    UPPER(legacy.name) LIKE '%CANCEL%' OR UPPER(legacy.name) LIKE '%CONCLU%' OR UPPER(legacy.name) LIKE '%DONE%',
    NULL
FROM `workflow_statuses` AS legacy
CROSS JOIN `workflows`
WHERE legacy.workflow_id IS NULL;

-- Preserve every item while moving it to the equivalent status in its project/type workflow.
UPDATE `items` AS item
INNER JOIN `workflow_statuses` AS legacy_status ON legacy_status.id = item.workflow_status_id
INNER JOIN `workflows` AS workflow
    ON workflow.project_id = item.project_id
    AND workflow.item_type = item.type
    AND workflow.is_default = true
INNER JOIN `workflow_statuses` AS scoped_status
    ON scoped_status.workflow_id = workflow.id
    AND scoped_status.name = legacy_status.name
SET item.workflow_status_id = scoped_status.id
WHERE legacy_status.workflow_id IS NULL;

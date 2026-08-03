-- Capture only untouched default BUG workflows so customized workflows remain unchanged.
DROP TABLE IF EXISTS `_migration_default_bug_workflows`;

CREATE TABLE `_migration_default_bug_workflows` (
  `id` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `_migration_default_bug_workflows` (`id`)
SELECT workflow.id
FROM `workflows` AS workflow
WHERE workflow.item_type = 'BUG'
  AND workflow.is_default = true
  AND NOT EXISTS (
    SELECT 1 FROM `workflow_statuses` existing
    WHERE existing.workflow_id = workflow.id AND existing.name = 'Registrado'
  );

-- Only default BUG workflows that have not received the new template are extended.
INSERT INTO `workflow_statuses`
  (`id`, `workflow_id`, `name`, `category`, `color`, `position`, `order`, `is_active`, `is_initial`, `is_final`)
SELECT UUID(), workflow.id, template.name, template.category, template.color, template.position, template.position, true, template.is_initial, template.is_final
FROM `workflows` AS workflow
INNER JOIN `_migration_default_bug_workflows` migrated ON migrated.id = workflow.id
CROSS JOIN (
  SELECT 'Registrado' name, 'BACKLOG' category, '#64748B' color, 10 position, true is_initial, false is_final
  UNION ALL SELECT 'Triagem', 'TODO', '#3B82F6', 20, false, false
  UNION ALL SELECT 'Aguardando informações', 'TODO', '#A855F7', 30, false, false
  UNION ALL SELECT 'Em correção', 'IN_PROGRESS', '#F59E0B', 40, false, false
  UNION ALL SELECT 'Code review', 'REVIEW', '#8B5CF6', 50, false, false
  UNION ALL SELECT 'Pronto para reteste', 'REVIEW', '#06B6D4', 60, false, false
  UNION ALL SELECT 'Em reteste', 'IN_PROGRESS', '#0EA5E9', 70, false, false
  UNION ALL SELECT 'Homologado', 'DONE', '#22C55E', 80, false, false
  UNION ALL SELECT 'Fechado', 'DONE', '#16A34A', 90, false, true
  UNION ALL SELECT 'Reaberto', 'IN_PROGRESS', '#EF4444', 100, false, false
) AS template
WHERE workflow.item_type = 'BUG' AND workflow.is_default = true;

-- Preserve every BUG while mapping generic categories to the specialized workflow.
UPDATE `items` AS item
INNER JOIN `workflow_statuses` AS current_status ON current_status.id = item.workflow_status_id
INNER JOIN `workflows` AS workflow ON workflow.id = current_status.workflow_id AND workflow.item_type = 'BUG' AND workflow.is_default = true
INNER JOIN `_migration_default_bug_workflows` migrated ON migrated.id = workflow.id
INNER JOIN `workflow_statuses` AS target_status ON target_status.workflow_id = workflow.id
  AND target_status.name = CASE
    WHEN current_status.category = 'DONE' THEN 'Fechado'
    WHEN current_status.category = 'REVIEW' THEN 'Code review'
    WHEN current_status.category = 'IN_PROGRESS' THEN 'Em correção'
    ELSE 'Registrado'
  END
SET item.workflow_status_id = target_status.id
WHERE item.type = 'BUG'
  AND current_status.name NOT IN ('Registrado', 'Triagem', 'Aguardando informações', 'Em correção', 'Code review', 'Pronto para reteste', 'Em reteste', 'Homologado', 'Fechado', 'Reaberto');

-- Retain old definitions for audit/compatibility, but hide them from active boards.
UPDATE `workflow_statuses` AS status_row
INNER JOIN `workflows` AS workflow ON workflow.id = status_row.workflow_id
INNER JOIN `_migration_default_bug_workflows` migrated ON migrated.id = workflow.id
SET status_row.is_active = false, status_row.is_initial = false, status_row.is_final = false
WHERE workflow.item_type = 'BUG'
  AND workflow.is_default = true
  AND status_row.name NOT IN ('Registrado', 'Triagem', 'Aguardando informações', 'Em correção', 'Code review', 'Pronto para reteste', 'Em reteste', 'Homologado', 'Fechado', 'Reaberto');

DROP TABLE `_migration_default_bug_workflows`;

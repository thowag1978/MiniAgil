-- Existing statuses remain available after the workflow administration API is introduced.
ALTER TABLE `workflow_statuses`
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true;

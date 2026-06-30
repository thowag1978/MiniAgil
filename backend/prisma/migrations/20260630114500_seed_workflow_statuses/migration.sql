-- Ensure every environment has the workflow reference data required to create items.
INSERT INTO `workflow_statuses` (`id`, `name`, `order`)
VALUES
    (UUID(), 'A FAZER', 10),
    (UUID(), 'EM PROGRESSO', 20),
    (UUID(), 'PARA REVISÃO', 30),
    (UUID(), 'CONCLUÍDO', 40)
ON DUPLICATE KEY UPDATE
    `order` = VALUES(`order`);

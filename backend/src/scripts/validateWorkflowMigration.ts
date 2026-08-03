import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function scalar(query: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ invalid_count: bigint }>>(query);
  return Number(rows[0]?.invalid_count ?? 0);
}

async function main() {
  const invalidItems = await scalar(`
    SELECT COUNT(*) AS invalid_count
    FROM items AS item
    INNER JOIN workflow_statuses AS status ON status.id = item.workflow_status_id
    LEFT JOIN workflows AS workflow ON workflow.id = status.workflow_id
    WHERE workflow.id IS NULL
       OR workflow.project_id <> item.project_id
       OR workflow.item_type <> item.type
  `);
  const missingWorkflows = await scalar(`
    SELECT COUNT(*) AS invalid_count
    FROM projects AS project
    CROSS JOIN (
      SELECT 'EPIC' AS item_type UNION ALL SELECT 'STORY' UNION ALL SELECT 'TASK'
      UNION ALL SELECT 'SUBTASK' UNION ALL SELECT 'BUG'
    ) AS item_types
    LEFT JOIN workflows AS workflow
      ON workflow.project_id = project.id
      AND workflow.item_type = item_types.item_type
      AND workflow.is_default = true
    WHERE workflow.id IS NULL
  `);
  const incompleteWorkflows = await scalar(`
    SELECT COUNT(*) AS invalid_count
    FROM workflows AS workflow
    WHERE NOT EXISTS (
      SELECT 1 FROM workflow_statuses AS status
      WHERE status.workflow_id = workflow.id AND status.is_initial = true
    ) OR NOT EXISTS (
      SELECT 1 FROM workflow_statuses AS status
      WHERE status.workflow_id = workflow.id AND status.is_final = true
    )
  `);

  if (invalidItems || missingWorkflows || incompleteWorkflows) {
    throw new Error(JSON.stringify({ invalidItems, missingWorkflows, incompleteWorkflows }));
  }
  console.log(JSON.stringify({ valid: true, invalidItems, missingWorkflows, incompleteWorkflows }));
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

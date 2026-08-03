import { prisma } from '../infrastructure/db';

const STEP = 1024;
const MIN_GAP = 0.001;
export class BacklogOrderError extends Error { constructor(public statusCode: number, message: string) { super(message); } }

export async function moveBacklogItem(input: { itemId: string; targetIndex: number; userId: string; expectedUpdatedAt?: string }) {
  const item = await prisma.item.findUnique({ where: { id: input.itemId }, select: { id: true, project_id: true, sprint_id: true } });
  if (!item) throw new BacklogOrderError(404, 'Item not found');
  if (item.sprint_id) throw new BacklogOrderError(400, 'Only items outside a sprint can be reordered in the backlog');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM items WHERE id = ${item.id} FOR UPDATE`;
    const locked = await tx.item.findUnique({ where: { id: item.id }, select: { updatedAt: true } });
    if (!locked) throw new BacklogOrderError(404, 'Item not found');
    if (input.expectedUpdatedAt && locked.updatedAt.toISOString() !== new Date(input.expectedUpdatedAt).toISOString()) throw new BacklogOrderError(409, 'Item changed. Reload the backlog and try again');
    const siblings = await tx.item.findMany({ where: { project_id: item.project_id, sprint_id: null, id: { not: item.id }, type: { in: ['STORY', 'TASK', 'BUG'] } }, select: { id: true, backlog_position: true }, orderBy: [{ backlog_position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
    if (!Number.isInteger(input.targetIndex) || input.targetIndex < 0 || input.targetIndex > siblings.length) throw new BacklogOrderError(400, 'target_index is outside the backlog');
    let positions = siblings.map(entry => entry.backlog_position);
    const previous = positions[input.targetIndex - 1]; const next = positions[input.targetIndex];
    if (previous !== undefined && next !== undefined && next - previous <= MIN_GAP) {
      await Promise.all(siblings.map((entry, index) => tx.item.update({ where: { id: entry.id }, data: { backlog_position: (index + 1) * STEP } })));
      positions = siblings.map((_, index) => (index + 1) * STEP);
    }
    const before = positions[input.targetIndex - 1]; const after = positions[input.targetIndex];
    const position = before === undefined ? (after === undefined ? STEP : after - STEP) : (after === undefined ? before + STEP : (before + after) / 2);
    return tx.item.update({ where: { id: item.id }, data: { backlog_position: position } });
  });
}

import { BugEnvironment, BugRetestResult } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../../infrastructure/db';
import { canUpdateItem, canViewProject } from '../../services/permissions';
import { BugRetestError, createBugRetest, listBugRetests } from '../../services/bugRetests';

export class BugRetestsController {
  async list(req: any, res: Response) {
    const item = await prisma.item.findUnique({ where: { id: req.params.itemId }, select: { id: true, type: true, project_id: true } });
    if (!item || !(await canViewProject(req.user.id, item.project_id))) return res.status(404).json({ error: 'Bug not found or access denied' });
    if (item.type !== 'BUG') return res.status(400).json({ error: 'Only BUG items can receive retests' });
    res.json(await listBugRetests(item.id));
  }

  async create(req: any, res: Response) {
    const item = await prisma.item.findUnique({ where: { id: req.params.itemId }, select: { id: true, type: true, project_id: true } });
    if (!item || !(await canViewProject(req.user.id, item.project_id))) return res.status(404).json({ error: 'Bug not found or access denied' });
    if (item.type !== 'BUG') return res.status(400).json({ error: 'Only BUG items can receive retests' });
    if (!(await canUpdateItem(req.user.id, item.project_id))) return res.status(403).json({ error: 'You do not have permission to retest bugs in this project' });

    const environment = String(req.body.environment || '').toUpperCase() as BugEnvironment;
    const result = String(req.body.result || '').toUpperCase() as BugRetestResult;
    if (!Object.values(BugEnvironment).includes(environment)) return res.status(400).json({ error: 'Invalid retest environment' });
    if (!Object.values(BugRetestResult).includes(result)) return res.status(400).json({ error: 'Invalid retest result' });
    if (req.body.observations !== undefined && req.body.observations !== null && typeof req.body.observations !== 'string') return res.status(400).json({ error: 'Observations must be text' });

    try {
      const retest = await createBugRetest({
        bugId: item.id, testerId: req.user.id, environment, result,
        observations: typeof req.body.observations === 'string' ? req.body.observations.trim() : null,
        ...(req.body.target_status_id ? { targetStatusId: String(req.body.target_status_id) } : {}),
      });
      res.status(201).json(retest);
    } catch (error) {
      if (error instanceof BugRetestError) return res.status(error.statusCode).json({ error: error.message });
      throw error;
    }
  }
}

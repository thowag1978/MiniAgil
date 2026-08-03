import { Request, Response } from 'express';
import { prisma } from '../../infrastructure/db';
import { canCreateItem, canUpdateItem, canViewProject } from '../../services/permissions';
import { addStoryToSprint, removeStoryFromSprint, SprintPlanningError } from '../../services/sprintPlanning';
import { cancelSprint, finishSprint, SprintLifecycleError, startSprint } from '../../services/sprintLifecycle';
import { getProjectVelocity, getSprintMetrics } from '../../services/sprintMetrics';

export class SprintsController {
  async metrics(req: any, res: Response) {
    const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id }, select: { project_id: true } });
    if (!sprint || !(await canViewProject(req.user.id, sprint.project_id))) return res.status(404).json({ error: 'Sprint not found or access denied' });
    return res.json(await getSprintMetrics(req.params.id));
  }

  async velocity(req: any, res: Response) {
    const projectId = String(req.query.project_id || '');
    if (!projectId) return res.status(400).json({ error: 'project_id query param is required' });
    if (!(await canViewProject(req.user.id, projectId))) return res.status(404).json({ error: 'Project not found or access denied' });
    return res.json(await getProjectVelocity(projectId));
  }

  private async plan(req: any, res: Response, add: boolean) {
    const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id }, select: { project_id: true } });
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });
    if (!(await canUpdateItem(req.user.id, sprint.project_id))) return res.status(403).json({ error: 'You do not have permission to plan this sprint' });
    try {
      const input = { sprintId: req.params.id, itemId: req.params.itemId, userId: req.user.id };
      res.json(add ? await addStoryToSprint(input) : await removeStoryFromSprint(input));
    } catch (error) {
      if (error instanceof SprintPlanningError) return res.status(error.statusCode).json({ error: error.message });
      throw error;
    }
  }

  addItem = (req: any, res: Response) => this.plan(req, res, true);
  removeItem = (req: any, res: Response) => this.plan(req, res, false);

  async create(req: any, res: Response) {
    const { name, goal, startDate, endDate, project_id } = req.body;
    
    if (!name || !project_id) {
      return res.status(400).json({ error: 'Name and project_id are required' });
    }

    if (!(await canCreateItem(req.user.id, project_id))) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedEndDate = endDate ? new Date(endDate) : null;
    if ((parsedStartDate && Number.isNaN(parsedStartDate.getTime())) || (parsedEndDate && Number.isNaN(parsedEndDate.getTime()))) {
      return res.status(400).json({ error: 'Invalid sprint dates' });
    }
    if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
      return res.status(400).json({ error: 'Sprint end date must be after start date' });
    }

    const sprint = await prisma.sprint.create({
      data: { name, goal, startDate: parsedStartDate, endDate: parsedEndDate, project_id }
    });
    
    res.status(201).json(sprint);
  }

  async list(req: any, res: Response) {
    const { project_id } = req.query;

    if (!project_id) {
       return res.status(400).json({ error: 'project_id query param is required' });
    }

    if (!(await canViewProject(req.user.id, String(project_id)))) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const sprints = await prisma.sprint.findMany({
      where: { project_id: String(project_id) },
      orderBy: { createdAt: 'asc' }
    });

    res.json(sprints);
  }

  async updateStatus(req: any, res: Response) {
    const { id } = req.params;
    const { status } = req.body;

    const requestedStatus = String(status || '').toUpperCase();
    const normalizedStatus = requestedStatus === 'CLOSED' ? 'FINISHED' : requestedStatus;
    if (!['ACTIVE', 'FINISHED', 'CANCELLED'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid sprint status' });
    }

    const sprint = await prisma.sprint.findFirst({
      where: { id },
      select: { id: true, project_id: true }
    });

    if (!sprint) {
      return res.status(404).json({ error: 'Sprint not found or access denied' });
    }

    if (!(await canUpdateItem(req.user.id, sprint.project_id))) {
      return res.status(403).json({ error: 'You do not have permission to update sprints in this project' });
    }

    try {
      if (normalizedStatus === 'ACTIVE') return res.json(await startSprint(sprint.id, req.user.id));
      if (normalizedStatus === 'CANCELLED') return res.json(await cancelSprint(sprint.id, req.user.id));
      const pendingDestination = String(req.body.pending_destination || '').toUpperCase() as 'BACKLOG' | 'SPRINT';
      return res.json(await finishSprint({
        sprintId: sprint.id, userId: req.user.id, pendingDestination,
        ...(req.body.target_sprint_id ? { targetSprintId: String(req.body.target_sprint_id) } : {}),
      }));
    } catch (error) {
      if (error instanceof SprintLifecycleError) return res.status(error.statusCode).json({ error: error.message });
      throw error;
    }
  }
}

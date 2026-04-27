import { Request, Response } from 'express';
import { ItemType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/db';

function normalizeStatusName(statusName?: string | null): string {
  return (statusName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export class ItemsController {
  async create(req: any, res: Response) {
    const {
      type,
      title,
      description,
      priority,
      project_id,
      sprint_id,
      parent_id,
      workflow_status_id,
      acceptance_criteria,
      estimate,
    } = req.body;

    if (!type || !title || !project_id || !workflow_status_id) {
      return res.status(400).json({ error: 'Type, title, project_id, and workflow_status_id are required' });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: project_id,
        OR: [
          { owner_id: req.user.id },
          { members: { some: { user_id: req.user.id } } },
        ],
      },
    });
    if (!project) return res.status(404).json({ error: 'Project not found or access denied' });

    const normalizedType = String(type).toUpperCase();
    if (!Object.values(ItemType).includes(normalizedType as ItemType)) {
      return res.status(400).json({ error: 'Invalid item type' });
    }
    const itemType = normalizedType as ItemType;

    if (itemType === 'STORY') {
      if (!parent_id) return res.status(400).json({ error: 'Historia de Usuario deve ter um Epico vinculado' });
      const parent = await prisma.item.findUnique({ where: { id: parent_id } });
      if (!parent || parent.type !== 'EPIC' || parent.project_id !== project_id) {
        return res.status(400).json({ error: 'O item pai deve ser um Epico valido' });
      }
    }

    if (itemType === 'TASK') {
      if (!parent_id) return res.status(400).json({ error: 'Atividade deve ter uma Historia vinculada' });
      const parent = await prisma.item.findUnique({ where: { id: parent_id } });
      if (!parent || parent.type !== 'STORY' || parent.project_id !== project_id) {
        return res.status(400).json({ error: 'O item pai deve ser uma Historia valida' });
      }
    }

    let item = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await prisma.item.count({ where: { project_id } });
      const project_key = `${project.key_prefix}-${count + 1}`;

      try {
        item = await prisma.item.create({
          data: {
            project_key,
            type: itemType,
            title,
            description,
            priority: priority || 'MEDIUM',
            reporter_id: req.user.id,
            project_id,
            sprint_id,
            parent_id,
            workflow_status_id,
            acceptance_criteria,
            estimate: estimate ? parseInt(estimate, 10) : null,
          },
        });
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          Array.isArray(error.meta?.target) &&
          error.meta.target.includes('project_key')
        ) {
          continue;
        }
        throw error;
      }
    }

    if (!item) {
      return res.status(409).json({ error: 'Failed to generate unique project key. Please retry.' });
    }

    res.status(201).json(item);
  }

  async list(req: any, res: Response) {
    const { project_id, sprint_id, type } = req.query;
    const where: any = {
      project: {
        OR: [
          { owner_id: req.user.id },
          { members: { some: { user_id: req.user.id } } },
        ],
      },
      project_id: project_id ? String(project_id) : undefined,
      sprint_id: sprint_id ? String(sprint_id) : undefined,
    };

    if (type) {
      const normalizedType = String(type).toUpperCase();
      if (!Object.values(ItemType).includes(normalizedType as ItemType)) {
        return res.status(400).json({ error: 'Invalid item type filter' });
      }
      where.type = normalizedType as ItemType;
    }

    const items = await prisma.item.findMany({
      where,
      include: {
        assignee: { select: { name: true, email: true } },
        reporter: { select: { name: true } },
        workflow_status: true,
        parent: { select: { id: true, title: true, project_key: true, type: true } },
        children: { select: { id: true, title: true, project_key: true, type: true, workflow_status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(items);
  }

  async updateField(req: any, res: Response) {
    const { id } = req.params;
    const { workflow_status_id, assignee_id, sprint_id, priority, title, description, parent_id, acceptance_criteria, estimate } = req.body;

    const existingItem = await prisma.item.findFirst({
      where: {
        id,
        project: {
          OR: [
            { owner_id: req.user.id },
            { members: { some: { user_id: req.user.id } } },
          ],
        },
      },
      select: { id: true, type: true, project_id: true },
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (parent_id !== undefined && parent_id !== null) {
      const parent = await prisma.item.findUnique({ where: { id: parent_id } });
      if (!parent || parent.project_id !== existingItem.project_id) {
        return res.status(400).json({ error: 'Parent item must belong to the same project' });
      }

      if (existingItem.type === 'STORY' && parent.type !== 'EPIC') {
        return res.status(400).json({ error: 'Story parent must be an EPIC' });
      }

      if (existingItem.type === 'TASK' && parent.type !== 'STORY') {
        return res.status(400).json({ error: 'Task parent must be a STORY' });
      }
    }

    const data: any = {};
    if (workflow_status_id !== undefined) data.workflow_status_id = workflow_status_id;
    if (assignee_id !== undefined) data.assignee_id = assignee_id;
    if (sprint_id !== undefined) data.sprint_id = sprint_id;
    if (priority !== undefined) data.priority = priority;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (parent_id !== undefined) data.parent_id = parent_id;
    if (acceptance_criteria !== undefined) data.acceptance_criteria = acceptance_criteria;
    if (estimate !== undefined) data.estimate = estimate ? parseInt(estimate, 10) : null;

    if (sprint_id === null) data.sprint_id = null;
    if (assignee_id === null) data.assignee_id = null;
    if (parent_id === null) data.parent_id = null;

    const updated = await prisma.item.update({
      where: { id },
      data,
      include: {
        workflow_status: true,
        assignee: true,
        parent: { select: { id: true, title: true, project_key: true, type: true } },
        children: { select: { id: true, title: true, project_key: true, type: true, workflow_status: true } },
      },
    });

    res.json(updated);
  }

  async listStatuses(req: Request, res: Response) {
    const statuses = await prisma.workflowStatus.findMany({ orderBy: { order: 'asc' } });
    res.json(statuses);
  }

  async dashboardMetrics(req: any, res: Response) {
    const myItems = await prisma.item.findMany({
      where: {
        project: {
          OR: [
            { owner_id: req.user.id },
            { members: { some: { user_id: req.user.id } } },
          ],
        },
        OR: [{ assignee_id: req.user.id }, { reporter_id: req.user.id }],
      },
      include: {
        workflow_status: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { owner_id: req.user.id },
          { members: { some: { user_id: req.user.id } } },
        ],
      },
      select: { id: true, name: true, key_prefix: true },
      orderBy: { createdAt: 'desc' },
    });

    const projectIds = projects.map((project) => project.id);

    const itemsByProject = projectIds.length > 0
      ? await prisma.item.findMany({
          where: { project_id: { in: projectIds } },
          select: { project_id: true, workflow_status: { select: { name: true } } },
        })
      : [];

    const totalByProjectMap = new Map<string, number>();
    const doneByProjectMap = new Map<string, number>();

    for (const row of itemsByProject) {
      totalByProjectMap.set(row.project_id, (totalByProjectMap.get(row.project_id) ?? 0) + 1);
      if (normalizeStatusName(row.workflow_status?.name) === 'CONCLUIDO') {
        doneByProjectMap.set(row.project_id, (doneByProjectMap.get(row.project_id) ?? 0) + 1);
      }
    }

    const projectOverview = projects.map((project) => {
      const total = totalByProjectMap.get(project.id) ?? 0;
      const done = doneByProjectMap.get(project.id) ?? 0;
      const open = Math.max(total - done, 0);

      return {
        id: project.id,
        name: project.name,
        key_prefix: project.key_prefix,
        totalItems: total,
        openItems: open,
        doneItems: done,
      };
    });

    const counts = {
      pending: 0,
      inProgress: 0,
      review: 0,
      done: 0,
    };

    for (const item of myItems) {
      const normalized = normalizeStatusName(item.workflow_status?.name);
      if (normalized === 'CONCLUIDO') {
        counts.done += 1;
      } else if (normalized === 'EM PROGRESSO') {
        counts.inProgress += 1;
      } else if (normalized === 'PARA REVISAO') {
        counts.review += 1;
      } else {
        counts.pending += 1;
      }
    }

    res.json({
      counts,
      recentItems: myItems,
      projectOverview,
    });
  }

  async backlogOverview(req: any, res: Response) {
    const { project_id } = req.query;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: String(project_id),
        OR: [
          { owner_id: req.user.id },
          { members: { some: { user_id: req.user.id } } },
        ],
      },
      select: { id: true, name: true, key_prefix: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const activeSprint = await prisma.sprint.findFirst({
      where: { project_id: project.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    const sprintItemsWhere: { project_id: string; sprint_id?: string } = {
      project_id: project.id,
    };
    if (activeSprint?.id) {
      sprintItemsWhere.sprint_id = activeSprint.id;
    }

    const sprintItems = await prisma.item.findMany({
      where: sprintItemsWhere,
      include: {
        workflow_status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const backlogItems = await prisma.item.findMany({
      where: {
        project_id: project.id,
        sprint_id: null,
      },
      include: {
        workflow_status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      project,
      activeSprint,
      sprintItems,
      backlogItems,
    });
  }

  async listHierarchical(req: any, res: Response) {
    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id is required' });

    const projectAccessWhere =
      req.user.role === 'ADMIN'
        ? { id: String(project_id) }
        : {
            id: String(project_id),
            OR: [
              { owner_id: req.user.id },
              { members: { some: { user_id: req.user.id } } },
            ],
          };

    const project = await prisma.project.findFirst({
      where: projectAccessWhere,
      select: { id: true },
    });
    if (!project) return res.status(404).json({ error: 'Project not found or access denied' });

    const epics = await prisma.item.findMany({
      where: { project_id: project.id, type: 'EPIC' },
      include: {
        assignee: { select: { name: true, email: true } },
        workflow_status: true,
        children: {
          where: { type: 'STORY' },
          include: {
            assignee: { select: { name: true, email: true } },
            workflow_status: true,
            children: {
              where: { type: 'TASK' },
              include: {
                assignee: { select: { name: true, email: true } },
                workflow_status: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(epics);
  }
  async listHierarchicalTree(req: any, res: Response) {
    const projectAccessWhere =
      req.user.role === 'ADMIN'
        ? {}
        : {
            OR: [
              { owner_id: req.user.id },
              { members: { some: { user_id: req.user.id } } },
            ],
          };

    let projects = await prisma.project.findMany({
      where: projectAccessWhere,
      select: {
        id: true,
        name: true,
        key_prefix: true,
        description: true,
        items: {
          where: { type: 'EPIC' },
          include: {
            assignee: { select: { name: true, email: true } },
            workflow_status: true,
            children: {
              where: { type: 'STORY' },
              include: {
                assignee: { select: { name: true, email: true } },
                workflow_status: true,
                children: {
                  where: { type: 'TASK' },
                  include: {
                    assignee: { select: { name: true, email: true } },
                    workflow_status: true,
                  },
                  orderBy: { createdAt: 'asc' },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fallback for legacy environments where projects exist but project_members is not populated.
    if (req.user.role !== 'ADMIN' && projects.length === 0) {
      projects = await prisma.project.findMany({
        select: {
          id: true,
          name: true,
          key_prefix: true,
          description: true,
          items: {
            where: { type: 'EPIC' },
            include: {
              assignee: { select: { name: true, email: true } },
              workflow_status: true,
              children: {
                where: { type: 'STORY' },
                include: {
                  assignee: { select: { name: true, email: true } },
                  workflow_status: true,
                  children: {
                    where: { type: 'TASK' },
                    include: {
                      assignee: { select: { name: true, email: true } },
                      workflow_status: true,
                    },
                    orderBy: { createdAt: 'asc' },
                  },
                },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const tree = projects.map((project) => ({
      id: project.id,
      name: project.name,
      key_prefix: project.key_prefix,
      description: project.description,
      epics: project.items,
    }));

    res.json(tree);
  }
  async delete(req: any, res: Response) {
    const { id } = req.params;

    const item = await prisma.item.findFirst({
      where: {
        id,
        project: {
          OR: [
            { owner_id: req.user.id },
            { members: { some: { user_id: req.user.id } } },
          ],
        },
      },
      include: { _count: { select: { children: true } } },
    });

    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (item._count.children > 0) {
      return res.status(400).json({ error: 'Nao e possivel excluir um item que possui filhos vinculados.' });
    }

    await prisma.item.delete({ where: { id } });
    res.json({ success: true });
  }
}


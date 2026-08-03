import { Response } from 'express';
import { BugEnvironment, BugSeverity, ItemHistoryEvent, ItemType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/db';
import {
  canCreateItem,
  canDeleteItem,
  canUpdateItem,
  canViewProject,
  getProjectAccessWhere,
} from '../../services/permissions';
import { recordCommentHistory, recordItemChanges, recordItemCreated } from '../../services/itemHistory';
import { listWorkflowStatuses, resolveWorkflowStatusId } from '../../services/workflowStatuses';
import { validateWorkflowTransition, WorkflowTransitionError } from '../../services/workflowTransitions';
import { KanbanMoveError, moveKanbanItem } from '../../services/kanbanBoard';
import { InvalidSavedViewFiltersError, kanbanFiltersWhere, normalizeKanbanFilters } from '../../services/savedViewFilters';
import { InvalidBugDetailsError, parseBugDetails } from '../../services/bugDetails';
import { applyCustomFieldValues, customFieldValueInclude } from '../../services/customFields';
import { BacklogOrderError, moveBacklogItem } from '../../services/backlogOrder';
import { getProjectDashboard, parseProjectDashboardFilters, ProjectDashboardError } from '../../services/projectDashboard';
import { publishDomainEvent } from '../../services/domainEventOutbox';

type LockedProjectCounter = {
  id: string;
  key_prefix: string;
  next_item_number: number;
};

export class ItemsController {
  async moveInBacklog(req: any, res: Response) {
    const { id } = req.params;
    if (!Number.isInteger(req.body.target_index)) return res.status(400).json({ error: 'integer target_index is required' });
    const item = await prisma.item.findUnique({ where: { id }, select: { project_id: true } });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (!(await canUpdateItem(req.user.id, item.project_id))) return res.status(403).json({ error: 'You do not have permission to reorder this backlog' });
    try { res.json(await moveBacklogItem({ itemId: id, targetIndex: req.body.target_index, userId: req.user.id, expectedUpdatedAt: req.body.expected_updated_at })); }
    catch (error) { if (error instanceof BacklogOrderError) return res.status(error.statusCode).json({ error: error.message }); throw error; }
  }

  async moveOnBoard(req: any, res: Response) {
    const { id } = req.params;
    const { workflow_status_id, target_index, expected_updated_at, transition_comment } = req.body;
    if (!workflow_status_id || !Number.isInteger(target_index)) {
      return res.status(400).json({ error: 'workflow_status_id and integer target_index are required' });
    }
    const item = await prisma.item.findUnique({ where: { id }, select: { project_id: true } });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (!(await canUpdateItem(req.user.id, item.project_id))) {
      return res.status(403).json({ error: 'You do not have permission to move items in this project' });
    }
    try {
      res.json(await moveKanbanItem({
        itemId: id, targetStatusId: workflow_status_id, targetIndex: target_index,
        userId: req.user.id, expectedUpdatedAt: expected_updated_at, transitionComment: transition_comment,
      }));
    } catch (error) {
      if (error instanceof KanbanMoveError) return res.status(error.statusCode).json({ error: error.message });
      throw error;
    }
  }

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
      bug_details,
      custom_fields,
      story_points,
      due_date,
    } = req.body;

    if (!type || !title || !project_id || !workflow_status_id) {
      return res.status(400).json({ error: 'Type, title, project_id, and workflow_status_id are required' });
    }

    if (!(await canCreateItem(req.user.id, project_id))) {
      return res.status(403).json({ error: 'You do not have permission to create items in this project' });
    }

    const project = await prisma.project.findUnique({
      where: { id: project_id },
      select: { id: true, key_prefix: true },
    });
    if (!project) return res.status(404).json({ error: 'Project not found or access denied' });

    const normalizedType = String(type).toUpperCase();
    if (!Object.values(ItemType).includes(normalizedType as ItemType)) {
      return res.status(400).json({ error: 'Invalid item type' });
    }
    const itemType = normalizedType as ItemType;
    const storyPointScale = [1, 2, 3, 5, 8, 13, 20];
    if (story_points !== undefined && itemType !== ItemType.STORY) return res.status(400).json({ error: 'story_points are only allowed for STORY items' });
    if (story_points !== undefined && story_points !== null && !storyPointScale.includes(Number(story_points))) return res.status(400).json({ error: 'story_points must use the scale 1, 2, 3, 5, 8, 13, 20' });
    if (itemType !== ItemType.BUG && bug_details !== undefined) {
      return res.status(400).json({ error: 'Only BUG items can have bug_details' });
    }

    if (due_date && Number.isNaN(new Date(String(due_date)).getTime())) {
      return res.status(400).json({ error: 'due_date must be a valid date' });
    }
    let parsedBugDetails;
    try { parsedBugDetails = itemType === ItemType.BUG ? parseBugDetails(bug_details) : undefined; }
    catch (error) {
      if (error instanceof InvalidBugDetailsError) return res.status(400).json({ error: error.message });
      throw error;
    }
    const resolvedWorkflowStatusId = await resolveWorkflowStatusId(workflow_status_id, project_id, itemType);
    if (!resolvedWorkflowStatusId) {
      return res.status(400).json({ error: 'Workflow status does not belong to this project and item type' });
    }

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

    const item = await prisma.$transaction(async (tx) => {
      const [lockedProject] = await tx.$queryRaw<LockedProjectCounter[]>`
        SELECT id, key_prefix, next_item_number
        FROM projects
        WHERE id = ${project_id}
        FOR UPDATE
      `;

      if (!lockedProject) {
        throw new Error('Project not found while generating item key');
      }

      const project_key = `${lockedProject.key_prefix}-${lockedProject.next_item_number}`;

      const created = await tx.item.create({
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
          workflow_status_id: resolvedWorkflowStatusId,
          acceptance_criteria,
          estimate: estimate ? parseInt(estimate, 10) : null,
          story_points: story_points === undefined || story_points === null ? null : Number(story_points),
          due_date: due_date ? new Date(String(due_date)) : null,
          ...(parsedBugDetails ? { bug_details: { create: parsedBugDetails } } : {}),
        },
        include: { bug_details: true, ...customFieldValueInclude },
      });

      await applyCustomFieldValues(tx, { itemId: created.id, projectId: project_id, itemType, values: custom_fields, requireAll: true });

      await tx.project.update({
        where: { id: lockedProject.id },
        data: { next_item_number: { increment: 1 } },
      });

      await recordItemCreated(tx, created, req.user.id);

      return tx.item.findUniqueOrThrow({ where: { id: created.id }, include: { bug_details: true, ...customFieldValueInclude } });
    });

    await publishDomainEvent({ eventType: 'ITEM_CREATED', actor: { id: req.user.id }, project: { id: project_id }, entity: { type: 'ITEM', id: item.id }, payload: { itemType, projectKey: item.project_key } });
    if (itemType === ItemType.BUG) await publishDomainEvent({ eventType: 'BUG_CREATED', actor: { id: req.user.id }, project: { id: project_id }, entity: { type: 'BUG', id: item.id }, payload: { projectKey: item.project_key } });

    res.status(201).json(item);
  }

  async list(req: any, res: Response) {
    const { project_id, sprint_id, type, severity, environment, assignee_id, status_id, reopened, board, backlog, custom_field_id, custom_field_value } = req.query;
    const projectAccessWhere = await getProjectAccessWhere(req.user.id);
    const where: Prisma.ItemWhereInput = { project: projectAccessWhere };
    const bugDetailsFilter: Prisma.BugDetailsWhereInput = {};

    if (project_id) {
      const projectId = String(project_id);
      if (!(await canViewProject(req.user.id, projectId))) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }
      where.project_id = projectId;
    }
    if (sprint_id) where.sprint_id = String(sprint_id);

    if (type) {
      const normalizedType = String(type).toUpperCase();
      if (!Object.values(ItemType).includes(normalizedType as ItemType)) {
        return res.status(400).json({ error: 'Invalid item type filter' });
      }
      where.type = normalizedType as ItemType;
    }
    if (severity) {
      const severities = String(severity).split(',').map((entry) => entry.trim().toUpperCase()).filter(Boolean);
      if (!severities.length || severities.some((entry) => !Object.values(BugSeverity).includes(entry as BugSeverity))) return res.status(400).json({ error: 'Invalid bug severity' });
      bugDetailsFilter.severity = severities.length === 1 ? severities[0] as BugSeverity : { in: severities as BugSeverity[] };
    }
    if (environment) {
      const normalizedEnvironment = String(environment).toUpperCase();
      if (!Object.values(BugEnvironment).includes(normalizedEnvironment as BugEnvironment)) return res.status(400).json({ error: 'Invalid bug environment' });
      bugDetailsFilter.environment = normalizedEnvironment as BugEnvironment;
    }
    if (assignee_id) where.assignee_id = String(assignee_id);
    if (status_id) where.workflow_status_id = String(status_id);
    if (reopened !== undefined) {
      if (!['true', 'false'].includes(String(reopened))) return res.status(400).json({ error: 'reopened must be true or false' });
      if (String(reopened) === 'true') bugDetailsFilter.reopened_count = { gt: 0 };
    }
    if (board !== undefined && !['true', 'false'].includes(String(board))) return res.status(400).json({ error: 'board must be true or false' });
    if (backlog !== undefined && !['true', 'false'].includes(String(backlog))) return res.status(400).json({ error: 'backlog must be true or false' });
    if ((custom_field_id && custom_field_value === undefined) || (!custom_field_id && custom_field_value !== undefined)) return res.status(400).json({ error: 'custom_field_id and custom_field_value must be provided together' });
    if (custom_field_id) {
      const field = await prisma.customField.findFirst({ where: {
        id: String(custom_field_id), is_active: true, use_in_filters: true,
        ...(project_id ? { project_id: String(project_id) } : {}), ...(type ? { item_type: String(type).toUpperCase() as ItemType } : {}),
      } });
      if (!field) return res.status(400).json({ error: 'Custom field is not available for filtering' });
      let filterValue: string | number | boolean = String(custom_field_value);
      if (field.field_type === 'NUMBER') { filterValue = Number(custom_field_value); if (!Number.isFinite(filterValue)) return res.status(400).json({ error: 'Invalid custom field number filter' }); }
      if (field.field_type === 'BOOLEAN') { if (!['true', 'false'].includes(String(custom_field_value))) return res.status(400).json({ error: 'Invalid custom field boolean filter' }); filterValue = String(custom_field_value) === 'true'; }
      where.custom_field_values = { some: { field_id: field.id, value: field.field_type === 'MULTISELECT' ? { array_contains: String(custom_field_value) } : { equals: filterValue } } };
    }
    if (Object.keys(bugDetailsFilter).length) where.bug_details = { is: bugDetailsFilter };

    const items = await prisma.item.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        reporter: { select: { name: true } },
        project: { select: { id: true, name: true, key_prefix: true } },
        sprint: { select: { id: true, name: true, status: true } },
        workflow_status: true,
        bug_details: true,
        ...customFieldValueInclude,
        parent: { select: { id: true, title: true, project_key: true, type: true } },
        children: { select: { id: true, title: true, project_key: true, type: true, workflow_status: true } },
      },
      orderBy: String(backlog) === 'true'
        ? [{ backlog_position: 'asc' }, { createdAt: 'asc' }]
        : String(board) === 'true'
        ? [{ workflow_status_id: 'asc' }, { board_position: 'asc' }, { createdAt: 'asc' }]
        : { createdAt: 'desc' },
    });

    res.json(items);
  }

  async updateField(req: any, res: Response) {
    const { id } = req.params;
    const { workflow_status_id, assignee_id, sprint_id, priority, title, description, parent_id, acceptance_criteria, estimate, story_points, due_date, transition_comment, bug_details, custom_fields } = req.body;

    const existingItem = await prisma.item.findFirst({
      where: { id },
      select: {
        id: true,
        type: true,
        project_id: true,
        title: true,
        description: true,
        priority: true,
        estimate: true,
        story_points: true,
        acceptance_criteria: true,
        workflow_status: { select: { id: true, name: true, workflow_id: true } },
        assignee: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
      },
    });

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (!(await canUpdateItem(req.user.id, existingItem.project_id))) {
      return res.status(403).json({ error: 'You do not have permission to update items in this project' });
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
    let validatedTransition: Awaited<ReturnType<typeof validateWorkflowTransition>> = null;
    if (workflow_status_id !== undefined) {
      const resolvedStatusId = await resolveWorkflowStatusId(
        workflow_status_id,
        existingItem.project_id,
        existingItem.type,
      );
      if (!resolvedStatusId) {
        return res.status(400).json({ error: 'Workflow status does not belong to this project and item type' });
      }
      if (resolvedStatusId !== existingItem.workflow_status.id) {
        const targetStatus = await prisma.workflowStatus.findUnique({
          where: { id: resolvedStatusId },
          select: { id: true, workflow_id: true, is_active: true },
        });
        if (!targetStatus?.workflow_id || targetStatus.is_active === false || targetStatus.workflow_id !== existingItem.workflow_status.workflow_id) {
          return res.status(400).json({ error: 'Target workflow status is not active or compatible with the item workflow' });
        }
        try {
          validatedTransition = await validateWorkflowTransition({
            workflowId: targetStatus.workflow_id,
            fromStatusId: existingItem.workflow_status.id,
            toStatusId: resolvedStatusId,
            projectId: existingItem.project_id,
            userId: req.user.id,
            assigneeId: assignee_id !== undefined ? assignee_id : existingItem.assignee?.id,
            comment: transition_comment,
          });
        } catch (error) {
          if (error instanceof WorkflowTransitionError) return res.status(400).json({ error: error.message });
          throw error;
        }
      }
      data.workflow_status_id = resolvedStatusId;
    }

    if (sprint_id !== undefined) {
      return res.status(400).json({ error: 'Use the sprint planning endpoints to change sprint assignment' });
    }

    if (existingItem.type !== ItemType.BUG && bug_details !== undefined) {
      return res.status(400).json({ error: 'Only BUG items can have bug_details' });
    }
    let parsedBugDetails;
    try { parsedBugDetails = existingItem.type === ItemType.BUG && bug_details !== undefined ? parseBugDetails(bug_details) : undefined; }
    catch (error) {
      if (error instanceof InvalidBugDetailsError) return res.status(400).json({ error: error.message });
      throw error;
    }
    if (assignee_id !== undefined) data.assignee_id = assignee_id;
    if (priority !== undefined) data.priority = priority;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (parent_id !== undefined) data.parent_id = parent_id;
    if (acceptance_criteria !== undefined) data.acceptance_criteria = acceptance_criteria;
    if (estimate !== undefined) data.estimate = estimate ? parseInt(estimate, 10) : null;
    if (due_date !== undefined) {
      const parsedDueDate = due_date === null || due_date === '' ? null : new Date(String(due_date));
      if (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) return res.status(400).json({ error: 'due_date must be a valid date' });
      data.due_date = parsedDueDate;
    }
    if (story_points !== undefined) {
      if (existingItem.type !== ItemType.STORY) return res.status(400).json({ error: 'story_points are only allowed for STORY items' });
      if (story_points !== null && ![1, 2, 3, 5, 8, 13, 20].includes(Number(story_points))) return res.status(400).json({ error: 'story_points must use the scale 1, 2, 3, 5, 8, 13, 20' });
      data.story_points = story_points === null ? null : Number(story_points);
    }

    if (assignee_id === null) data.assignee_id = null;
    if (parent_id === null) data.parent_id = null;

    const updated = await prisma.$transaction(async (tx) => {
      if (parsedBugDetails) {
        await tx.bugDetails.upsert({
          where: { item_id: id },
          create: { item_id: id, ...parsedBugDetails },
          update: parsedBugDetails,
        });
      }
      if (custom_fields !== undefined) await applyCustomFieldValues(tx, { itemId: id, projectId: existingItem.project_id, itemType: existingItem.type, values: custom_fields, requireAll: false });
      const updatedItem = await tx.item.update({
        where: { id },
        data,
        include: {
          workflow_status: true,
          bug_details: true,
          ...customFieldValueInclude,
          assignee: true,
          sprint: true,
          parent: { select: { id: true, title: true, project_key: true, type: true } },
          children: { select: { id: true, title: true, project_key: true, type: true, workflow_status: true } },
        },
      });

      await recordItemChanges(tx, existingItem, updatedItem, req.user.id);
      if (validatedTransition?.requires_comment) {
        const comment = await tx.comment.create({
          data: { text: String(transition_comment).trim(), user_id: req.user.id, item_id: id },
        });
        await recordCommentHistory(tx, {
          itemId: id,
          projectId: existingItem.project_id,
          userId: req.user.id,
          commentId: comment.id,
          eventType: ItemHistoryEvent.COMMENT_CREATED,
          newText: comment.text,
        });
      }
      return updatedItem;
    });

    await publishDomainEvent({ eventType: 'ITEM_UPDATED', actor: { id: req.user.id }, project: { id: existingItem.project_id }, entity: { type: 'ITEM', id: updated.id }, payload: { changedFields: Object.keys(data) } });
    if (existingItem.workflow_status.id !== updated.workflow_status_id) await publishDomainEvent({ eventType: 'ITEM_STATUS_CHANGED', actor: { id: req.user.id }, project: { id: existingItem.project_id }, entity: { type: 'ITEM', id: updated.id }, payload: { fromStatusId: existingItem.workflow_status.id, toStatusId: updated.workflow_status_id } });
    if ((existingItem.assignee?.id ?? null) !== updated.assignee_id) await publishDomainEvent({ eventType: 'ITEM_ASSIGNED', actor: { id: req.user.id }, project: { id: existingItem.project_id }, entity: { type: 'ITEM', id: updated.id }, payload: { previousAssigneeId: existingItem.assignee?.id ?? null, assigneeId: updated.assignee_id } });

    res.json(updated);
  }

  async listStatuses(req: any, res: Response) {
    const { project_id, type } = req.query;
    if ((project_id && !type) || (!project_id && type)) {
      return res.status(400).json({ error: 'project_id and type must be provided together' });
    }
    let itemType: ItemType | undefined;
    if (type) {
      const normalizedType = String(type).toUpperCase();
      if (!Object.values(ItemType).includes(normalizedType as ItemType)) {
        return res.status(400).json({ error: 'Invalid item type' });
      }
      itemType = normalizedType as ItemType;
      if (!(await canViewProject(req.user.id, String(project_id)))) {
        return res.status(404).json({ error: 'Project not found or access denied' });
      }
    }
    const statuses = await listWorkflowStatuses(
      project_id ? String(project_id) : undefined,
      itemType,
    );
    res.json(statuses);
  }

  async dashboardMetrics(req: any, res: Response) {
    try {
      const filters = parseProjectDashboardFilters(req.query);
      if (!(await canViewProject(req.user.id, filters.projectId))) return res.status(404).json({ error: 'Project not found or access denied' });
      return res.json(await getProjectDashboard(filters));
    } catch (error) {
      if (error instanceof ProjectDashboardError) return res.status(error.statusCode).json({ error: error.message });
      throw error;
    }
  }

  async backlogOverview(req: any, res: Response) {
    const { project_id } = req.query;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }
    if (req.query.without_story_points !== undefined && !['true', 'false'].includes(String(req.query.without_story_points))) {
      return res.status(400).json({ error: 'without_story_points must be true or false' });
    }

    if (!(await canViewProject(req.user.id, String(project_id)))) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const project = await prisma.project.findUnique({
      where: { id: String(project_id) },
      select: { id: true, name: true, key_prefix: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    let filters;
    try {
      const split = (value: unknown) => String(value).split(',').map((entry) => entry.trim()).filter(Boolean);
      const rawFilters: Record<string, unknown> = {};
      if (req.query.type) rawFilters.types = split(req.query.type);
      if (req.query.status_id) rawFilters.status_ids = split(req.query.status_id);
      if (req.query.assignee_id) rawFilters.assignee_id = String(req.query.assignee_id);
      if (req.query.priority) rawFilters.priorities = split(req.query.priority);
      if (req.query.sprint_id) rawFilters.sprint_id = String(req.query.sprint_id);
      if (req.query.epic_id) rawFilters.epic_id = String(req.query.epic_id);
      if (req.query.text) rawFilters.text = String(req.query.text);
      if (req.query.unassigned !== undefined) {
        if (!['true', 'false'].includes(String(req.query.unassigned))) throw new InvalidSavedViewFiltersError('unassigned must be true or false');
        rawFilters.unassigned = String(req.query.unassigned) === 'true';
      }
      filters = normalizeKanbanFilters(rawFilters);
    } catch (error) {
      if (error instanceof InvalidSavedViewFiltersError) return res.status(400).json({ error: error.message });
      throw error;
    }
    const filterWhere = kanbanFiltersWhere(filters);

    const activeSprint = await prisma.sprint.findFirst({
      where: filters.sprint_id
        ? { id: filters.sprint_id, project_id: project.id }
        : { project_id: project.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (filters.sprint_id && !activeSprint) return res.status(400).json({ error: 'Sprint filter does not belong to this project' });

    const itemInclude = {
      assignee: { select: { name: true, email: true } },
      reporter: { select: { name: true } },
      project: { select: { id: true, name: true, key_prefix: true } },
      sprint: { select: { id: true, name: true, status: true } },
      workflow_status: true,
      ...customFieldValueInclude,
      parent: { select: { id: true, title: true, project_key: true, type: true } },
      children: { select: { id: true, title: true, project_key: true, type: true, workflow_status: true } },
    };

    const sprintItems = activeSprint?.id
      ? await prisma.item.findMany({
          where: {
            project_id: project.id,
            type: { in: ['STORY', 'TASK', 'BUG'] },
            AND: [
              { OR: [{ sprint_id: activeSprint.id }, { parent: { sprint_id: activeSprint.id } }] },
              filterWhere,
            ],
          },
          include: itemInclude,
          orderBy: [{ backlog_position: 'asc' }, { createdAt: 'asc' }],
        })
      : [];

    const backlogItems = await prisma.item.findMany({
      where: {
        project_id: project.id,
        type: { in: ['STORY', 'TASK', 'BUG'] },
        sprint_id: null,
        AND: [
          { OR: [{ parent_id: null }, { parent: { sprint_id: null } }] },
          filterWhere,
          ...(req.query.without_story_points === 'true' ? [{ type: ItemType.STORY, story_points: null }] : []),
        ],
      },
      include: itemInclude,
      orderBy: [{ backlog_position: 'asc' }, { createdAt: 'asc' }],
    });

    const boardStatuses = await prisma.workflowStatus.findMany({
      where: {
        is_active: true,
        workflow: { project_id: project.id, item_type: { in: [ItemType.TASK, ItemType.BUG] } },
      },
      select: { id: true, name: true, wip_limit: true, position: true, workflow: { select: { item_type: true } } },
      orderBy: [{ workflow: { item_type: 'asc' } }, { position: 'asc' }],
    });
    const boardCounts = new Map<string, number>();
    for (const item of sprintItems) {
      boardCounts.set(item.workflow_status_id, (boardCounts.get(item.workflow_status_id) || 0) + 1);
    }
    const columns = boardStatuses.map((status) => {
      const count = boardCounts.get(status.id) || 0;
      return {
        status_id: status.id,
        name: status.name,
        item_type: status.workflow?.item_type,
        position: status.position,
        count,
        wip_limit: status.wip_limit,
        exceeded: status.wip_limit !== null && count > status.wip_limit,
      };
    });

    res.json({
      project,
      activeSprint,
      sprintItems,
      backlogItems,
      storyPointSummary: {
        total: [...sprintItems, ...backlogItems].filter((item) => item.type === 'STORY').reduce((sum, item) => sum + (item.story_points || 0), 0),
        withoutPoints: [...sprintItems, ...backlogItems].filter((item) => item.type === 'STORY' && item.story_points === null).length,
      },
      columns,
    });
  }

  async listHierarchical(req: any, res: Response) {
    const { project_id } = req.query;
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    if (!(await canViewProject(req.user.id, String(project_id)))) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const project = await prisma.project.findUnique({
      where: { id: String(project_id) },
      select: { id: true },
    });
    if (!project) return res.status(404).json({ error: 'Project not found or access denied' });

    const epics = await prisma.item.findMany({
      where: { project_id: project.id, type: 'EPIC' },
      include: {
        assignee: { select: { name: true, email: true } },
        project: { select: { id: true, name: true, key_prefix: true } },
        workflow_status: true,
        children: {
          where: { type: 'STORY' },
          include: {
            assignee: { select: { name: true, email: true } },
            project: { select: { id: true, name: true, key_prefix: true } },
            workflow_status: true,
            children: {
              where: { type: 'TASK' },
              include: {
                assignee: { select: { name: true, email: true } },
                project: { select: { id: true, name: true, key_prefix: true } },
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
    const backlogItemInclude = {
      assignee: { select: { name: true, email: true } },
      project: { select: { id: true, name: true, key_prefix: true } },
      workflow_status: true,
      ...customFieldValueInclude,
    } satisfies Prisma.ItemInclude;

    const projectAccessWhere = await getProjectAccessWhere(req.user.id);

    let projects = await prisma.project.findMany({
      where: projectAccessWhere,
      select: {
        id: true,
        name: true,
        key_prefix: true,
        description: true,
        items: {
          where: { type: { in: ['EPIC', 'STORY', 'TASK'] } },
          include: backlogItemInclude,
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const typeOrder = { EPIC: 0, STORY: 1, TASK: 2 };
    const sortItems = (a: any, b: any) => {
      const typeDiff = typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
      if (typeDiff !== 0) return typeDiff;
      return String(a.project_key).localeCompare(String(b.project_key), undefined, { numeric: true });
    };

    const buildTree = (items: any[]) => {
      const itemMap = new Map(items.map((item) => [item.id, { ...item, children: [] as any[] }]));
      const attachedIds = new Set<string>();

      itemMap.forEach((item) => {
        if (item.parent_id && itemMap.has(item.parent_id)) {
          itemMap.get(item.parent_id).children.push(item);
          attachedIds.add(item.id);
        }
      });

      itemMap.forEach((item) => item.children.sort(sortItems));

      return Array.from(itemMap.values())
        .filter((item) => item.type === 'EPIC' || !attachedIds.has(item.id))
        .sort(sortItems);
    };

    const tree = projects.map((project) => ({
      id: project.id,
      name: project.name,
      key_prefix: project.key_prefix,
      description: project.description,
      epics: buildTree(project.items),
    }));

    res.json(tree);
  }
  async delete(req: any, res: Response) {
    const { id } = req.params;

    const item = await prisma.item.findFirst({
      where: { id },
      include: { _count: { select: { children: true } } },
    });

    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (!(await canDeleteItem(req.user.id, item.project_id))) {
      return res.status(403).json({ error: 'You do not have permission to delete items in this project' });
    }

    if (item._count.children > 0) {
      return res.status(400).json({ error: 'Nao e possivel excluir um item que possui filhos vinculados.' });
    }

    await prisma.item.delete({ where: { id } });
    res.json({ success: true });
  }
}


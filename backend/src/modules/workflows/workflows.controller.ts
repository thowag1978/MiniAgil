import { ItemType, Prisma, ProjectRole, WorkflowCategory } from '@prisma/client';
import { Response } from 'express';
import { canViewProject, isProjectOwnerOrAdmin } from '../../services/permissions';
import {
  WorkflowManagementError, createProjectWorkflow, createWorkflowStatus, deleteWorkflowStatus,
  getProjectWorkflowByType, listProjectWorkflows, renameProjectWorkflow, reorderWorkflowStatuses,
  updateWorkflowStatus,
  createWorkflowTransition, listWorkflowTransitions, updateWorkflowTransition,
} from '../../services/workflowManagement';

const itemTypes = Object.values(ItemType);
const categories = Object.values(WorkflowCategory);
const colorPattern = /^#[0-9A-F]{6}$/i;
const projectRoles = Object.values(ProjectRole);

function handleError(error: unknown, res: Response) {
  if (error instanceof WorkflowManagementError) return res.status(error.statusCode).json({ error: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return res.status(409).json({ error: 'A workflow or status with this name already exists' });
  }
  throw error;
}

function parseStatusPayload(body: any, partial = false) {
  const data: any = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? '').trim();
    if (!name) throw new WorkflowManagementError(400, 'Status name is required');
    data.name = name;
  }
  if (!partial || body.category !== undefined) {
    if (!categories.includes(body.category)) throw new WorkflowManagementError(400, 'Invalid workflow category');
    data.category = body.category;
  }
  if (body.color !== undefined) {
    if (!colorPattern.test(body.color)) throw new WorkflowManagementError(400, 'Color must use #RRGGBB format');
    data.color = body.color.toUpperCase();
  }
  if (body.position !== undefined) {
    if (!Number.isInteger(body.position) || body.position < 0) throw new WorkflowManagementError(400, 'Position must be a non-negative integer');
    data.position = body.position;
    data.order = body.position;
  }
  if (body.wip_limit !== undefined) {
    if (body.wip_limit !== null && (!Number.isInteger(body.wip_limit) || body.wip_limit < 1)) {
      throw new WorkflowManagementError(400, 'WIP limit must be a positive integer or null');
    }
    data.wip_limit = body.wip_limit;
  }
  for (const field of ['is_active', 'is_initial', 'is_final']) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'boolean') throw new WorkflowManagementError(400, `${field} must be boolean`);
      data[field] = body[field];
    }
  }
  return data;
}

export class WorkflowsController {
  private async canManage(req: any, res: Response) {
    if (!(await isProjectOwnerOrAdmin(req.user.id, req.params.projectId))) {
      res.status(403).json({ error: 'Only project OWNER or ADMIN can manage workflows' });
      return false;
    }
    return true;
  }

  list = async (req: any, res: Response) => {
    if (!(await canViewProject(req.user.id, req.params.projectId))) return res.status(404).json({ error: 'Project not found' });
    res.json(await listProjectWorkflows(req.params.projectId));
  };

  getByType = async (req: any, res: Response) => {
    if (!(await canViewProject(req.user.id, req.params.projectId))) return res.status(404).json({ error: 'Project not found' });
    if (!itemTypes.includes(req.params.itemType)) return res.status(400).json({ error: 'Invalid item type' });
    try { res.json(await getProjectWorkflowByType(req.params.projectId, req.params.itemType)); } catch (error) { return handleError(error, res); }
  };

  create = async (req: any, res: Response) => {
    if (!(await this.canManage(req, res))) return;
    const name = String(req.body.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Workflow name is required' });
    if (!itemTypes.includes(req.body.item_type)) return res.status(400).json({ error: 'Invalid item type' });
    try { res.status(201).json(await createProjectWorkflow(req.params.projectId, name, req.body.item_type)); } catch (error) { return handleError(error, res); }
  };

  update = async (req: any, res: Response) => {
    if (!(await this.canManage(req, res))) return;
    const name = String(req.body.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Workflow name is required' });
    try { res.json(await renameProjectWorkflow(req.params.projectId, req.params.workflowId, name)); } catch (error) { return handleError(error, res); }
  };

  createStatus = async (req: any, res: Response) => {
    if (!(await this.canManage(req, res))) return;
    try { res.status(201).json(await createWorkflowStatus(req.params.projectId, req.params.workflowId, parseStatusPayload(req.body))); } catch (error) { return handleError(error, res); }
  };

  updateStatus = async (req: any, res: Response) => {
    if (!(await this.canManage(req, res))) return;
    try {
      res.json(await updateWorkflowStatus(req.params.projectId, req.params.workflowId, req.params.statusId, parseStatusPayload(req.body, true), req.body.replacement_status_id));
    } catch (error) { return handleError(error, res); }
  };

  reorderStatuses = async (req: any, res: Response) => {
    if (!(await this.canManage(req, res))) return;
    if (!Array.isArray(req.body.status_ids) || req.body.status_ids.some((id: unknown) => typeof id !== 'string')) {
      return res.status(400).json({ error: 'status_ids must be an array of status IDs' });
    }
    try { res.json(await reorderWorkflowStatuses(req.params.projectId, req.params.workflowId, req.body.status_ids)); } catch (error) { return handleError(error, res); }
  };

  deleteStatus = async (req: any, res: Response) => {
    if (!(await this.canManage(req, res))) return;
    try { await deleteWorkflowStatus(req.params.projectId, req.params.workflowId, req.params.statusId); res.status(204).send(); } catch (error) { return handleError(error, res); }
  };

  createTransition = async (req: any, res: Response) => {
    if (!(await this.canManage(req, res))) return;
    const { from_status_id, to_status_id, allowed_role, requires_comment, requires_assignee, is_active } = req.body;
    if (!from_status_id || !to_status_id) return res.status(400).json({ error: 'from_status_id and to_status_id are required' });
    if (allowed_role !== undefined && allowed_role !== null && !projectRoles.includes(allowed_role)) {
      return res.status(400).json({ error: 'Invalid project role' });
    }
    try {
      res.status(201).json(await createWorkflowTransition(req.params.projectId, req.params.workflowId, {
        from_status_id, to_status_id, allowed_role: allowed_role ?? null,
        requires_comment: Boolean(requires_comment), requires_assignee: Boolean(requires_assignee),
        is_active: is_active === undefined ? true : Boolean(is_active),
      }));
    } catch (error) { return handleError(error, res); }
  };

  listTransitions = async (req: any, res: Response) => {
    if (!(await canViewProject(req.user.id, req.params.projectId))) return res.status(404).json({ error: 'Project not found' });
    try { res.json(await listWorkflowTransitions(req.params.projectId, req.params.workflowId)); }
    catch (error) { return handleError(error, res); }
  };

  updateTransition = async (req: any, res: Response) => {
    if (!(await this.canManage(req, res))) return;
    const data: any = {};
    if (req.body.allowed_role !== undefined) {
      if (req.body.allowed_role !== null && !projectRoles.includes(req.body.allowed_role)) return res.status(400).json({ error: 'Invalid project role' });
      data.allowed_role = req.body.allowed_role;
    }
    for (const field of ['requires_comment', 'requires_assignee', 'is_active']) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== 'boolean') return res.status(400).json({ error: `${field} must be boolean` });
        data[field] = req.body[field];
      }
    }
    try { res.json(await updateWorkflowTransition(req.params.projectId, req.params.workflowId, req.params.transitionId, data)); }
    catch (error) { return handleError(error, res); }
  };
}

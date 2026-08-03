import { CustomFieldType, ItemType, Prisma } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../../infrastructure/db';
import { canViewProject, isProjectOwnerOrAdmin } from '../../services/permissions';

const types = Object.values(CustomFieldType);
const itemTypes = Object.values(ItemType);
const include = { options: { orderBy: { position: 'asc' as const } } };

export class CustomFieldsController {
  list = async (req: any, res: Response) => {
    const itemType = String(req.query.item_type || '').toUpperCase() as ItemType;
    if (!itemTypes.includes(itemType)) return res.status(400).json({ error: 'Valid item_type is required' });
    if (!(await canViewProject(req.user.id, req.params.projectId))) return res.status(404).json({ error: 'Project not found' });
    const includeInactive = req.query.include_inactive === 'true' && await isProjectOwnerOrAdmin(req.user.id, req.params.projectId);
    res.json(await prisma.customField.findMany({
      where: { project_id: req.params.projectId, item_type: itemType, ...(includeInactive ? {} : { is_active: true }) },
      include, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    }));
  };

  create = async (req: any, res: Response) => {
    if (!(await isProjectOwnerOrAdmin(req.user.id, req.params.projectId))) return res.status(403).json({ error: 'Only project OWNER or ADMIN can manage custom fields' });
    const name = String(req.body.name || '').trim();
    const itemType = String(req.body.item_type || '').toUpperCase() as ItemType;
    const fieldType = String(req.body.field_type || '').toUpperCase() as CustomFieldType;
    if (!name || !itemTypes.includes(itemType) || !types.includes(fieldType)) return res.status(400).json({ error: 'Name, valid item_type and field_type are required' });
    const rawOptions = Array.isArray(req.body.options) ? req.body.options : [];
    if ((fieldType === CustomFieldType.SELECT || fieldType === CustomFieldType.MULTISELECT) && rawOptions.length === 0) return res.status(400).json({ error: 'SELECT fields require options' });
    const options = rawOptions.map((option: any, index: number) => ({ label: String(option.label || '').trim(), value: String(option.value || '').trim(), position: index }));
    if (options.some((option: any) => !option.label || !option.value) || new Set(options.map((option: any) => option.value)).size !== options.length) return res.status(400).json({ error: 'Options require unique values and labels' });
    try {
      res.status(201).json(await prisma.customField.create({ data: {
        project_id: req.params.projectId, item_type: itemType, name, field_type: fieldType,
        is_required: Boolean(req.body.is_required), position: Number.isInteger(req.body.position) ? req.body.position : 0,
        show_on_card: Boolean(req.body.show_on_card), use_in_filters: Boolean(req.body.use_in_filters),
        options: { create: options },
      }, include }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: 'Custom field or option already exists' });
      throw error;
    }
  };

  update = async (req: any, res: Response) => {
    if (!(await isProjectOwnerOrAdmin(req.user.id, req.params.projectId))) return res.status(403).json({ error: 'Only project OWNER or ADMIN can manage custom fields' });
    const field = await prisma.customField.findFirst({ where: { id: req.params.fieldId, project_id: req.params.projectId } });
    if (!field) return res.status(404).json({ error: 'Custom field not found' });
    const data: Prisma.CustomFieldUpdateInput = {};
    if (req.body.name !== undefined) { const name = String(req.body.name).trim(); if (!name) return res.status(400).json({ error: 'Name is required' }); data.name = name; }
    if (req.body.position !== undefined) { if (!Number.isInteger(req.body.position) || req.body.position < 0) return res.status(400).json({ error: 'Position must be non-negative' }); data.position = req.body.position; }
    for (const key of ['is_required', 'is_active', 'show_on_card', 'use_in_filters'] as const) {
      if (req.body[key] !== undefined) { if (typeof req.body[key] !== 'boolean') return res.status(400).json({ error: `${key} must be boolean` }); data[key] = req.body[key]; }
    }
    res.json(await prisma.customField.update({ where: { id: field.id }, data, include }));
  };

  createOption = async (req: any, res: Response) => {
    if (!(await isProjectOwnerOrAdmin(req.user.id, req.params.projectId))) return res.status(403).json({ error: 'Only project OWNER or ADMIN can manage custom fields' });
    const field = await prisma.customField.findFirst({ where: { id: req.params.fieldId, project_id: req.params.projectId } });
    if (!field || (field.field_type !== CustomFieldType.SELECT && field.field_type !== CustomFieldType.MULTISELECT)) return res.status(404).json({ error: 'Selectable custom field not found' });
    const label = String(req.body.label || '').trim(); const value = String(req.body.value || '').trim();
    if (!label || !value) return res.status(400).json({ error: 'Option label and value are required' });
    res.status(201).json(await prisma.customFieldOption.create({ data: { field_id: field.id, label, value, position: Number.isInteger(req.body.position) ? req.body.position : 0 } }));
  };

  updateOption = async (req: any, res: Response) => {
    if (!(await isProjectOwnerOrAdmin(req.user.id, req.params.projectId))) return res.status(403).json({ error: 'Only project OWNER or ADMIN can manage custom fields' });
    const option = await prisma.customFieldOption.findFirst({ where: { id: req.params.optionId, field: { id: req.params.fieldId, project_id: req.params.projectId } } });
    if (!option) return res.status(404).json({ error: 'Custom field option not found' });
    const data: Prisma.CustomFieldOptionUpdateInput = {};
    if (req.body.label !== undefined) data.label = String(req.body.label).trim();
    if (req.body.is_active !== undefined) { if (typeof req.body.is_active !== 'boolean') return res.status(400).json({ error: 'is_active must be boolean' }); data.is_active = req.body.is_active; }
    res.json(await prisma.customFieldOption.update({ where: { id: option.id }, data }));
  };
}

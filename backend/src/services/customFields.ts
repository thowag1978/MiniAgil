import { CustomFieldType, ItemType, Prisma } from '@prisma/client';

type DbClient = Prisma.TransactionClient;
export class CustomFieldValidationError extends Error { status = 400; }

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

async function validateValue(tx: DbClient, field: { id: string; name: string; field_type: CustomFieldType }, value: unknown): Promise<Prisma.InputJsonValue> {
  switch (field.field_type) {
    case CustomFieldType.TEXT:
    case CustomFieldType.LONG_TEXT:
      if (typeof value !== 'string') throw new CustomFieldValidationError(`${field.name} must be text`);
      return value;
    case CustomFieldType.NUMBER:
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new CustomFieldValidationError(`${field.name} must be a number`);
      return value;
    case CustomFieldType.BOOLEAN:
      if (typeof value !== 'boolean') throw new CustomFieldValidationError(`${field.name} must be boolean`);
      return value;
    case CustomFieldType.DATE:
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new CustomFieldValidationError(`${field.name} must be a valid date`);
      return value;
    case CustomFieldType.URL:
      if (typeof value !== 'string') throw new CustomFieldValidationError(`${field.name} must be a URL`);
      try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
      catch { throw new CustomFieldValidationError(`${field.name} must be a valid HTTP URL`); }
      return value;
    case CustomFieldType.USER:
      if (typeof value !== 'string' || !(await tx.user.findUnique({ where: { id: value }, select: { id: true } }))) throw new CustomFieldValidationError(`${field.name} must reference a valid user`);
      return value;
    case CustomFieldType.SELECT: {
      if (typeof value !== 'string') throw new CustomFieldValidationError(`${field.name} must use a valid option`);
      const option = await tx.customFieldOption.findFirst({ where: { field_id: field.id, value, is_active: true }, select: { id: true } });
      if (!option) throw new CustomFieldValidationError(`${field.name} must use a valid option`);
      return value;
    }
    case CustomFieldType.MULTISELECT: {
      if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) throw new CustomFieldValidationError(`${field.name} must use valid options`);
      const unique = [...new Set(value as string[])];
      const count = await tx.customFieldOption.count({ where: { field_id: field.id, value: { in: unique }, is_active: true } });
      if (count !== unique.length) throw new CustomFieldValidationError(`${field.name} must use valid options`);
      return unique;
    }
  }
}

export async function applyCustomFieldValues(tx: DbClient, input: {
  itemId: string; projectId: string; itemType: ItemType; values: unknown; requireAll: boolean;
}) {
  if (input.values !== undefined && (typeof input.values !== 'object' || input.values === null || Array.isArray(input.values))) {
    throw new CustomFieldValidationError('custom_fields must be an object keyed by field ID');
  }
  const supplied = (input.values || {}) as Record<string, unknown>;
  const fields = await tx.customField.findMany({
    where: { project_id: input.projectId, item_type: input.itemType, is_active: true },
    select: { id: true, name: true, field_type: true, is_required: true },
  });
  const byId = new Map(fields.map((field) => [field.id, field]));
  const unknown = Object.keys(supplied).find((id) => !byId.has(id));
  if (unknown) throw new CustomFieldValidationError('Custom field does not belong to this project and item type, or is inactive');
  if (input.requireAll) {
    const missing = fields.find((field) => field.is_required && isEmpty(supplied[field.id]));
    if (missing) throw new CustomFieldValidationError(`${missing.name} is required`);
  }
  for (const [fieldId, rawValue] of Object.entries(supplied)) {
    const field = byId.get(fieldId)!;
    if (isEmpty(rawValue)) {
      if (field.is_required) throw new CustomFieldValidationError(`${field.name} is required`);
      await tx.customFieldValue.deleteMany({ where: { item_id: input.itemId, field_id: fieldId } });
      continue;
    }
    const value = await validateValue(tx, field, rawValue);
    await tx.customFieldValue.upsert({
      where: { item_id_field_id: { item_id: input.itemId, field_id: fieldId } },
      create: { item_id: input.itemId, field_id: fieldId, value }, update: { value },
    });
  }
}

export const customFieldValueInclude = {
  custom_field_values: {
    include: { field: { include: { options: { where: { is_active: true }, orderBy: { position: 'asc' as const } } } } },
    orderBy: { field: { position: 'asc' as const } },
  },
};

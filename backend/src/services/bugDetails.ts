import { BugEnvironment, BugOrigin, BugReproducibility, BugSeverity, Prisma } from '@prisma/client';

export class InvalidBugDetailsError extends Error {}

const textFields = [
  'reproduction_steps', 'expected_result', 'actual_result', 'technical_analysis', 'root_cause', 'resolution',
] as const;

export function parseBugDetails(value: unknown): Prisma.BugDetailsUncheckedCreateWithoutItemInput {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new InvalidBugDetailsError('bug_details must be an object');
  const raw = value as Record<string, unknown>;
  const allowed = new Set(['severity', 'environment', 'origin', 'reproducibility', ...textFields, 'regression', 'reopened_count']);
  if (Object.keys(raw).some((key) => !allowed.has(key))) throw new InvalidBugDetailsError('Unsupported bug_details field');

  const data: Prisma.BugDetailsUncheckedCreateWithoutItemInput = {};
  const enumFields = {
    severity: Object.values(BugSeverity), environment: Object.values(BugEnvironment),
    origin: Object.values(BugOrigin), reproducibility: Object.values(BugReproducibility),
  } as const;
  for (const [field, values] of Object.entries(enumFields)) {
    if (raw[field] !== undefined) {
      if (typeof raw[field] !== 'string' || !values.includes(raw[field] as never)) throw new InvalidBugDetailsError(`Invalid bug ${field}`);
      (data as Record<string, unknown>)[field] = raw[field];
    }
  }
  for (const field of textFields) {
    if (raw[field] !== undefined) {
      if (raw[field] !== null && typeof raw[field] !== 'string') throw new InvalidBugDetailsError(`Invalid ${field}`);
      data[field] = typeof raw[field] === 'string' ? raw[field].trim() || null : null;
    }
  }
  if (raw.regression !== undefined) {
    if (typeof raw.regression !== 'boolean') throw new InvalidBugDetailsError('regression must be boolean');
    data.regression = raw.regression;
  }
  if (raw.reopened_count !== undefined) {
    if (!Number.isInteger(raw.reopened_count) || Number(raw.reopened_count) < 0) throw new InvalidBugDetailsError('reopened_count must be a non-negative integer');
    data.reopened_count = Number(raw.reopened_count);
  }
  return data;
}

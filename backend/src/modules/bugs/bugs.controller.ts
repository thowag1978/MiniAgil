import { Response } from 'express';
import { BugSeverity, BugStatus, Prisma, Priority } from '@prisma/client';
import { prisma } from '../../infrastructure/db';

type AttachmentInput = {
  fileName?: unknown;
  s3_url?: unknown;
  mimeType?: unknown;
  fileSize?: unknown;
};

const bugSelect = {
  id: true,
  protocol: true,
  title: true,
  description: true,
  stepsToReproduce: true,
  expectedResult: true,
  actualResult: true,
  environment: true,
  browserDevice: true,
  status: true,
  severity: true,
  priority: true,
  system_id: true,
  feature_id: true,
  reporter_id: true,
  assignee_id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  closedAt: true,
  system: { select: { id: true, name: true } },
  feature: { select: { id: true, name: true } },
  reporter: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true, email: true } },
  attachments: true,
} as const;

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeSeverity(value: unknown): BugSeverity {
  const normalized = normalizeText(value).toUpperCase();
  return Object.values(BugSeverity).includes(normalized as BugSeverity) ? normalized as BugSeverity : 'MEDIUM';
}

function normalizePriorityFromSeverity(value: unknown): Priority {
  return normalizeSeverity(value) as unknown as Priority;
}

function parsePriority(value: unknown): Priority | undefined {
  return parseEnum(value, Object.values(Priority));
}

function parseEnum<T extends string>(value: unknown, validValues: readonly T[]): T | undefined {
  const normalized = normalizeText(value).toUpperCase();
  return validValues.includes(normalized as T) ? normalized as T : undefined;
}

function parseDate(value: unknown, endOfDay = false): Date | undefined {
  const text = normalizeText(value);
  if (!text) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}

const statusCommentRequired = new Set<BugStatus>([
  'CLOSED',
  'REOPENED',
  'REJECTED',
  'DUPLICATED',
  'CANCELED',
]);

const openBugStatuses: BugStatus[] = [
  'OPEN',
  'TRIAGE',
  'CONFIRMED',
  'IN_FIX',
  'WAITING_VALIDATION',
  'REOPENED',
];

function buildStatusDateData(status: BugStatus) {
  const now = new Date();
  if (status === 'RESOLVED') return { resolvedAt: now };
  if (status === 'CLOSED') return { closedAt: now };
  if (status === 'REOPENED') return { resolvedAt: null, closedAt: null };
  return {};
}

function generateProtocol(): string {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
    String(date.getUTCSeconds()).padStart(2, '0'),
  ].join('');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BUG-${stamp}-${suffix}`;
}

function normalizeAttachments(attachments: unknown): Array<{
  fileName: string;
  s3_url: string;
  mimeType?: string;
  fileSize?: number;
}> {
  if (!Array.isArray(attachments)) return [];

  return attachments.reduce<Array<{ fileName: string; s3_url: string; mimeType?: string; fileSize?: number }>>((result, item) => {
    const attachment = item as AttachmentInput;
    const fileName = normalizeText(attachment.fileName);
    const s3Url = normalizeText(attachment.s3_url);
    if (!fileName || !s3Url) return result;

    const mimeType = normalizeOptionalText(attachment.mimeType) ?? undefined;
    const numericFileSize = Number(attachment.fileSize);
    result.push({
      fileName,
      s3_url: s3Url,
      ...(mimeType ? { mimeType } : {}),
      ...(Number.isFinite(numericFileSize) && numericFileSize > 0 ? { fileSize: numericFileSize } : {}),
    });
    return result;
  }, []);
}

export class BugsController {
  async dashboard(req: any, res: Response) {
    const [
      totalOpen,
      critical,
      reopened,
      bySystem,
      byStatus,
      byAssignee,
      resolvedBugs,
    ] = await Promise.all([
      prisma.bug.count({ where: { status: { in: openBugStatuses } } }),
      prisma.bug.count({ where: { severity: 'CRITICAL', status: { in: openBugStatuses } } }),
      prisma.bug.count({ where: { status: 'REOPENED' } }),
      prisma.bug.groupBy({
        by: ['system_id'],
        _count: { _all: true },
        orderBy: { _count: { system_id: 'desc' } },
      }),
      prisma.bug.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { _count: { status: 'desc' } },
      }),
      prisma.bug.groupBy({
        by: ['assignee_id'],
        _count: { _all: true },
        orderBy: { _count: { assignee_id: 'desc' } },
      }),
      prisma.bug.findMany({
        where: { resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    const systemIds = bySystem.map((item) => item.system_id);
    const assigneeIds = byAssignee.map((item) => item.assignee_id).filter((id): id is string => Boolean(id));

    const [systems, assignees] = await Promise.all([
      systemIds.length > 0
        ? prisma.bugSystem.findMany({ where: { id: { in: systemIds } }, select: { id: true, name: true } })
        : [],
      assigneeIds.length > 0
        ? prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const systemNameById = new Map(systems.map((system) => [system.id, system.name]));
    const assigneeNameById = new Map(assignees.map((user) => [user.id, user.name]));

    const totalResolutionMs = resolvedBugs.reduce((sum, bug) => {
      if (!bug.resolvedAt) return sum;
      return sum + (bug.resolvedAt.getTime() - bug.createdAt.getTime());
    }, 0);
    const averageResolutionHours = resolvedBugs.length > 0
      ? Math.round((totalResolutionMs / resolvedBugs.length / 1000 / 60 / 60) * 10) / 10
      : null;

    res.json({
      totalOpen,
      critical,
      reopened,
      averageResolutionHours,
      bySystem: bySystem.map((item) => ({
        system_id: item.system_id,
        name: systemNameById.get(item.system_id) || 'Sistema não encontrado',
        total: item._count._all,
      })),
      byStatus: byStatus.map((item) => ({
        status: item.status,
        total: item._count._all,
      })),
      byAssignee: byAssignee.map((item) => ({
        assignee_id: item.assignee_id,
        name: item.assignee_id ? assigneeNameById.get(item.assignee_id) || 'Responsável não encontrado' : 'Sem responsável',
        total: item._count._all,
      })),
    });
  }

  async list(req: any, res: Response) {
    const systemId = normalizeText(req.query.system_id);
    const featureId = normalizeText(req.query.feature_id);
    const assigneeId = normalizeText(req.query.assignee_id);
    const reporterId = normalizeText(req.query.reporter_id);
    const environment = normalizeText(req.query.environment);
    const status = parseEnum(req.query.status, Object.values(BugStatus));
    const severity = parseEnum(req.query.severity, Object.values(BugSeverity));
    const priority = parseEnum(req.query.priority, Object.values(Priority));
    const createdFrom = parseDate(req.query.created_from);
    const createdTo = parseDate(req.query.created_to, true);

    const where: Prisma.BugWhereInput = {};
    if (systemId) where.system_id = systemId;
    if (featureId) where.feature_id = featureId;
    if (assigneeId) where.assignee_id = assigneeId;
    if (reporterId) where.reporter_id = reporterId;
    if (environment) where.environment = { contains: environment };
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (priority) where.priority = priority;
    if (createdFrom || createdTo) {
      where.createdAt = {
        ...(createdFrom ? { gte: createdFrom } : {}),
        ...(createdTo ? { lte: createdTo } : {}),
      };
    }

    const bugs = await prisma.bug.findMany({
      where,
      select: bugSelect,
      orderBy: { createdAt: 'desc' },
    });

    res.json(bugs);
  }

  async getById(req: any, res: Response) {
    const { id } = req.params;

    const bug = await prisma.bug.findUnique({
      where: { id },
      include: {
        system: { select: { id: true, name: true } },
        feature: { select: { id: true, name: true } },
        reporter: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        comments: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!bug) {
      return res.status(404).json({ error: 'Bug não encontrado' });
    }

    res.json(bug);
  }

  async create(req: any, res: Response) {
    const systemId = normalizeText(req.body.system_id);
    const featureId = normalizeText(req.body.feature_id);
    const title = normalizeText(req.body.title);
    const attachments = normalizeAttachments(req.body.attachments);

    if (!systemId) {
      return res.status(400).json({ error: 'Sistema é obrigatório' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Título do bug é obrigatório' });
    }

    const system = await prisma.bugSystem.findFirst({
      where: { id: systemId, active: true },
      select: { id: true },
    });
    if (!system) {
      return res.status(404).json({ error: 'Sistema ativo não encontrado' });
    }

    if (featureId) {
      const feature = await prisma.bugFeature.findFirst({
        where: { id: featureId, system_id: systemId, active: true },
        select: { id: true },
      });
      if (!feature) {
        return res.status(400).json({ error: 'Funcionalidade ativa não encontrada para este sistema' });
      }
    }

    const protocol = generateProtocol();

    try {
      const bug = await prisma.bug.create({
        data: {
          protocol,
          title,
          description: normalizeOptionalText(req.body.description),
          stepsToReproduce: normalizeOptionalText(req.body.stepsToReproduce),
          expectedResult: normalizeOptionalText(req.body.expectedResult),
          actualResult: normalizeOptionalText(req.body.actualResult),
          environment: normalizeOptionalText(req.body.environment),
          browserDevice: normalizeOptionalText(req.body.browserDevice),
          severity: normalizeSeverity(req.body.severity),
          priority: normalizePriorityFromSeverity(req.body.severity),
          status: 'OPEN',
          system_id: systemId,
          feature_id: featureId || null,
          reporter_id: req.user.id,
          ...(attachments.length > 0 ? { attachments: {
            create: attachments.map((attachment) => ({
              ...attachment,
              user_id: req.user.id,
            })),
          } } : {}),
          statusHistory: {
            create: {
              to_status: 'OPEN',
              user_id: req.user.id,
            },
          },
        },
        select: bugSelect,
      });

      res.status(201).json(bug);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({ error: 'Não foi possível gerar um protocolo único. Tente novamente.' });
      }
      throw error;
    }
  }

  async addComment(req: any, res: Response) {
    const { id } = req.params;
    const text = normalizeText(req.body.text);

    if (!text) {
      return res.status(400).json({ error: 'Comentário é obrigatório' });
    }

    const bug = await prisma.bug.findUnique({ where: { id }, select: { id: true } });
    if (!bug) {
      return res.status(404).json({ error: 'Bug não encontrado' });
    }

    const comment = await prisma.bugComment.create({
      data: {
        bug_id: id,
        user_id: req.user.id,
        text,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json(comment);
  }

  async updateStatus(req: any, res: Response) {
    const { id } = req.params;
    const status = parseEnum(req.body.status, Object.values(BugStatus));
    const comment = normalizeText(req.body.comment);

    if (!status) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    if (statusCommentRequired.has(status) && !comment) {
      return res.status(400).json({ error: 'Comentário é obrigatório para esta alteração de status' });
    }

    const existing = await prisma.bug.findUnique({ where: { id }, select: { id: true, status: true, assignee_id: true } });
    if (!existing) {
      return res.status(404).json({ error: 'Bug não encontrado' });
    }

    if (status === 'IN_FIX' && !existing.assignee_id) {
      return res.status(400).json({ error: 'Bug precisa ter responsável antes de ir para Em correção' });
    }

    const bug = await prisma.bug.update({
      where: { id },
      data: {
        status,
        ...buildStatusDateData(status),
        statusHistory: {
          create: {
            from_status: existing.status,
            to_status: status,
            comment: comment || null,
            user_id: req.user.id,
          },
        },
      },
      select: bugSelect,
    });

    res.json(bug);
  }

  async updateAssignee(req: any, res: Response) {
    const { id } = req.params;
    const assigneeId = normalizeText(req.body.assignee_id);

    if (assigneeId) {
      const user = await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } });
      if (!user) {
        return res.status(404).json({ error: 'Responsável não encontrado' });
      }
    }

    try {
      const bug = await prisma.bug.update({
        where: { id },
        data: { assignee_id: assigneeId || null },
        select: bugSelect,
      });

      res.json(bug);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ error: 'Bug não encontrado' });
      }
      throw error;
    }
  }

  async updatePriority(req: any, res: Response) {
    const { id } = req.params;
    const priority = parsePriority(req.body.priority);

    if (!priority) {
      return res.status(400).json({ error: 'Prioridade inválida' });
    }

    try {
      const bug = await prisma.bug.update({
        where: { id },
        data: { priority },
        select: bugSelect,
      });

      res.json(bug);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ error: 'Bug não encontrado' });
      }
      throw error;
    }
  }

  async addAttachment(req: any, res: Response) {
    const { id } = req.params;
    const [attachment] = normalizeAttachments([req.body]);

    if (!attachment) {
      return res.status(400).json({ error: 'Nome do arquivo e URL do anexo são obrigatórios' });
    }

    const bug = await prisma.bug.findUnique({ where: { id }, select: { id: true } });
    if (!bug) {
      return res.status(404).json({ error: 'Bug não encontrado' });
    }

    const created = await prisma.bugAttachment.create({
      data: {
        ...attachment,
        bug_id: id,
        user_id: req.user.id,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json(created);
  }
}

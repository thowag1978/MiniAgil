import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    projectMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    item: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    sprint: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workflowStatus: {
      findMany: vi.fn(),
    },
    bugSystem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    bugFeature: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    bug: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    bugComment: {
      create: vi.fn(),
    },
    bugAttachment: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../src/infrastructure/db', () => ({
  prisma: prismaMock,
}));

let app: Awaited<ReturnType<typeof import('../src/app')>>['createApp'] extends (...args: any[]) => infer R ? R : never;

function makeToken(role: 'ADMIN' | 'USER' = 'ADMIN') {
  return jwt.sign(
    { id: 'user-1', email: 'user@miniagil.com', role },
    process.env.JWT_SECRET as string
  );
}

describe('API critical paths', () => {
  beforeAll(async () => {
    const { createApp } = await import('../src/app');
    app = createApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((callback: any) => callback(prismaMock));
  });

  it('login flow returns token', async () => {
    const hashed = await bcrypt.hash('admin123', 10);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'admin@miniagil.com',
      name: 'Admin',
      role: 'ADMIN',
      password: hashed,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@miniagil.com', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('admin@miniagil.com');
  });

  it('lists items for authenticated user', async () => {
    prismaMock.item.findMany.mockResolvedValueOnce([
      { id: 'item-1', title: 'Task 1', project_key: 'MINI-1', type: 'TASK' },
    ]);

    const res = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].id).toBe('item-1');
  });

  it('creates an item', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.project.findUnique.mockResolvedValueOnce({
      id: 'project-1',
      key_prefix: 'MINI',
    });
    prismaMock.$queryRaw.mockResolvedValueOnce([{
      id: 'project-1',
      key_prefix: 'MINI',
      next_item_number: 2,
    }]);
    prismaMock.item.create.mockResolvedValueOnce({
      id: 'item-2',
      project_key: 'MINI-2',
      title: 'Nova tarefa',
      type: 'EPIC',
    });
    prismaMock.project.update.mockResolvedValueOnce({ id: 'project-1', next_item_number: 3 });

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        type: 'EPIC',
        title: 'Nova tarefa',
        project_id: 'project-1',
        workflow_status_id: 'status-1',
      });

    expect(res.status).toBe(201);
    expect(res.body.project_key).toBe('MINI-2');
  });

  it('allows project OWNER to add a member', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ role: 'USER' })
      .mockResolvedValueOnce({ id: 'user-2' });
    prismaMock.projectMember.findFirst.mockResolvedValueOnce({ role: 'OWNER' });
    prismaMock.projectMember.findUnique.mockResolvedValueOnce(null);
    prismaMock.projectMember.create.mockResolvedValueOnce({
      id: 'member-2',
      project_id: 'project-1',
      user_id: 'user-2',
      role: 'MEMBER',
      user: { id: 'user-2', name: 'Ana', email: 'ana@miniagil.com' },
    });

    const res = await request(app)
      .post('/api/projects/project-1/members')
      .set('Authorization', `Bearer ${makeToken('USER')}`)
      .send({ user_id: 'user-2', role: 'MEMBER' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('MEMBER');
    expect(prismaMock.projectMember.create).toHaveBeenCalled();
  });

  it('blocks non-admin project member from adding members', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'USER' });
    prismaMock.projectMember.findFirst.mockResolvedValueOnce(null);
    prismaMock.project.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/projects/project-1/members')
      .set('Authorization', `Bearer ${makeToken('USER')}`)
      .send({ user_id: 'user-2', role: 'MEMBER' });

    expect(res.status).toBe(403);
    expect(prismaMock.projectMember.create).not.toHaveBeenCalled();
  });

  it('updates sprint status', async () => {
    prismaMock.sprint.findFirst.mockResolvedValueOnce({ id: 'sprint-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.sprint.update.mockResolvedValueOnce({ id: 'sprint-1', status: 'ACTIVE' });

    const res = await request(app)
      .patch('/api/sprints/sprint-1/status')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('lists users', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      { id: 'user-2', name: 'Ana', email: 'ana@miniagil.com', role: 'USER', createdAt: new Date().toISOString() },
    ]);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body[0].email).toBe('ana@miniagil.com');
  });

  it('blocks creating monitored bug system with empty name', async () => {
    const res = await request(app)
      .post('/api/bugs/systems')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: '   ', description: 'Sem nome' });

    expect(res.status).toBe(400);
    expect(prismaMock.bugSystem.create).not.toHaveBeenCalled();
  });

  it('creates monitored bug system', async () => {
    prismaMock.bugSystem.create.mockResolvedValueOnce({
      id: 'system-1',
      name: 'MiniAgil',
      description: 'Aplicacao principal',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/bugs/systems')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: ' MiniAgil ', description: ' Aplicacao principal ' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('MiniAgil');
    expect(prismaMock.bugSystem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'MiniAgil', active: true }),
    }));
  });

  it('lists only active monitored bug systems when requested', async () => {
    prismaMock.bugSystem.findMany.mockResolvedValueOnce([
      { id: 'system-1', name: 'MiniAgil', active: true },
    ]);

    const res = await request(app)
      .get('/api/bugs/systems?active=true')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(prismaMock.bugSystem.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { active: true },
    }));
  });

  it('toggles monitored bug system active status', async () => {
    prismaMock.bugSystem.update.mockResolvedValueOnce({
      id: 'system-1',
      name: 'MiniAgil',
      active: false,
    });

    const res = await request(app)
      .patch('/api/bugs/systems/system-1/active')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
    expect(prismaMock.bugSystem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'system-1' },
      data: { active: false },
    }));
  });

  it('blocks creating bug feature without system', async () => {
    const res = await request(app)
      .post('/api/bugs/features')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'Login' });

    expect(res.status).toBe(400);
    expect(prismaMock.bugFeature.create).not.toHaveBeenCalled();
  });

  it('creates bug feature linked to a system', async () => {
    prismaMock.bugSystem.findUnique.mockResolvedValueOnce({ id: 'system-1' });
    prismaMock.bugFeature.create.mockResolvedValueOnce({
      id: 'feature-1',
      system_id: 'system-1',
      name: 'Login',
      description: 'Entrada no sistema',
      active: true,
    });

    const res = await request(app)
      .post('/api/bugs/features')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ system_id: 'system-1', name: ' Login ', description: ' Entrada no sistema ' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Login');
    expect(prismaMock.bugFeature.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ system_id: 'system-1', name: 'Login', active: true }),
    }));
  });

  it('lists only active bug features for selected system', async () => {
    prismaMock.bugFeature.findMany.mockResolvedValueOnce([
      { id: 'feature-1', system_id: 'system-1', name: 'Login', active: true },
    ]);

    const res = await request(app)
      .get('/api/bugs/features?system_id=system-1&active=true')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(prismaMock.bugFeature.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { active: true, system_id: 'system-1' },
    }));
  });

  it('opens bug with automatic protocol and logged user as requester', async () => {
    prismaMock.bugSystem.findFirst.mockResolvedValueOnce({ id: 'system-1' });
    prismaMock.bugFeature.findFirst.mockResolvedValueOnce({ id: 'feature-1' });
    prismaMock.bug.create.mockResolvedValueOnce({
      id: 'bug-1',
      protocol: 'BUG-20260518101010-ABCDE',
      title: 'Erro no login',
      status: 'OPEN',
      severity: 'HIGH',
      system_id: 'system-1',
      feature_id: 'feature-1',
      reporter_id: 'user-1',
      attachments: [],
    });

    const res = await request(app)
      .post('/api/bugs')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        system_id: 'system-1',
        feature_id: 'feature-1',
        title: 'Erro no login',
        severity: 'HIGH',
        environment: 'Homologacao',
        browserDevice: 'Chrome Windows',
      });

    expect(res.status).toBe(201);
    expect(res.body.protocol).toMatch(/^BUG-/);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.reporter_id).toBe('user-1');
    expect(prismaMock.bug.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'OPEN',
        reporter_id: 'user-1',
        protocol: expect.stringMatching(/^BUG-/),
        statusHistory: { create: { to_status: 'OPEN', user_id: 'user-1' } },
      }),
    }));
  });

  it('lists bugs applying query filters', async () => {
    prismaMock.bug.findMany.mockResolvedValueOnce([
      {
        id: 'bug-1',
        protocol: 'BUG-20260518101010-ABCDE',
        title: 'Erro no login',
        status: 'OPEN',
        severity: 'HIGH',
        priority: 'HIGH',
      },
    ]);

    const res = await request(app)
      .get('/api/bugs?system_id=system-1&feature_id=feature-1&status=OPEN&severity=HIGH&priority=HIGH&assignee_id=user-2&reporter_id=user-1&environment=homologacao&created_from=2026-05-01&created_to=2026-05-18')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(prismaMock.bug.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        system_id: 'system-1',
        feature_id: 'feature-1',
        status: 'OPEN',
        severity: 'HIGH',
        priority: 'HIGH',
        assignee_id: 'user-2',
        reporter_id: 'user-1',
        environment: { contains: 'homologacao' },
        createdAt: expect.objectContaining({
          gte: expect.any(Date),
          lte: expect.any(Date),
        }),
      }),
      orderBy: { createdAt: 'desc' },
    }));
  });

  it('returns bug dashboard metrics', async () => {
    prismaMock.bug.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prismaMock.bug.groupBy
      .mockResolvedValueOnce([{ system_id: 'system-1', _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ status: 'OPEN', _count: { _all: 4 } }])
      .mockResolvedValueOnce([{ assignee_id: 'user-2', _count: { _all: 2 } }, { assignee_id: null, _count: { _all: 1 } }]);
    prismaMock.bug.findMany.mockResolvedValueOnce([
      { createdAt: new Date('2026-05-18T08:00:00Z'), resolvedAt: new Date('2026-05-18T12:00:00Z') },
    ]);
    prismaMock.bugSystem.findMany.mockResolvedValueOnce([{ id: 'system-1', name: 'MiniAgil' }]);
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'user-2', name: 'Ana' }]);

    const res = await request(app)
      .get('/api/bugs/dashboard')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.totalOpen).toBe(5);
    expect(res.body.critical).toBe(2);
    expect(res.body.reopened).toBe(1);
    expect(res.body.averageResolutionHours).toBe(4);
    expect(res.body.bySystem[0]).toEqual({ system_id: 'system-1', name: 'MiniAgil', total: 3 });
    expect(res.body.byAssignee[1]).toEqual({ assignee_id: null, name: 'Sem responsável', total: 1 });
  });

  it('adds comment to bug using logged user', async () => {
    prismaMock.bug.findUnique.mockResolvedValueOnce({ id: 'bug-1' });
    prismaMock.bugComment.create.mockResolvedValueOnce({
      id: 'comment-1',
      bug_id: 'bug-1',
      user_id: 'user-1',
      text: 'Investigando',
    });

    const res = await request(app)
      .post('/api/bugs/bug-1/comments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ text: 'Investigando' });

    expect(res.status).toBe(201);
    expect(prismaMock.bugComment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { bug_id: 'bug-1', user_id: 'user-1', text: 'Investigando' },
    }));
  });

  it('updates bug status and writes status history', async () => {
    prismaMock.bug.findUnique.mockResolvedValueOnce({ id: 'bug-1', status: 'OPEN', assignee_id: 'user-2' });
    prismaMock.bug.update.mockResolvedValueOnce({
      id: 'bug-1',
      status: 'IN_FIX',
    });

    const res = await request(app)
      .patch('/api/bugs/bug-1/status')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ status: 'IN_FIX' });

    expect(res.status).toBe(200);
    expect(prismaMock.bug.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'IN_FIX',
        statusHistory: {
          create: {
            from_status: 'OPEN',
            to_status: 'IN_FIX',
            comment: null,
            user_id: 'user-1',
          },
        },
      }),
    }));
  });

  it('blocks moving bug to in-fix without assignee', async () => {
    prismaMock.bug.findUnique.mockResolvedValueOnce({ id: 'bug-1', status: 'CONFIRMED', assignee_id: null });

    const res = await request(app)
      .patch('/api/bugs/bug-1/status')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ status: 'IN_FIX' });

    expect(res.status).toBe(400);
    expect(prismaMock.bug.update).not.toHaveBeenCalled();
  });

  it('requires comment for closing bug status', async () => {
    prismaMock.bug.findUnique.mockResolvedValueOnce({ id: 'bug-1', status: 'RESOLVED', assignee_id: 'user-2' });

    const res = await request(app)
      .patch('/api/bugs/bug-1/status')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ status: 'CLOSED' });

    expect(res.status).toBe(400);
    expect(prismaMock.bug.update).not.toHaveBeenCalled();
  });

  it('sets closedAt when closing bug with comment', async () => {
    prismaMock.bug.findUnique.mockResolvedValueOnce({ id: 'bug-1', status: 'RESOLVED', assignee_id: 'user-2' });
    prismaMock.bug.update.mockResolvedValueOnce({ id: 'bug-1', status: 'CLOSED' });

    const res = await request(app)
      .patch('/api/bugs/bug-1/status')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ status: 'CLOSED', comment: 'Validado pelo solicitante' });

    expect(res.status).toBe(200);
    expect(prismaMock.bug.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'CLOSED',
        closedAt: expect.any(Date),
        statusHistory: {
          create: {
            from_status: 'RESOLVED',
            to_status: 'CLOSED',
            comment: 'Validado pelo solicitante',
            user_id: 'user-1',
          },
        },
      }),
    }));
  });

  it('e2e: login then fetch items', async () => {
    const hashed = await bcrypt.hash('admin123', 10);
    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'admin@miniagil.com',
      name: 'Admin',
      role: 'ADMIN',
      password: hashed,
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@miniagil.com', password: 'admin123' });

    prismaMock.item.findMany.mockResolvedValueOnce([
      { id: 'item-3', title: 'Pipeline item', project_key: 'MINI-3', type: 'TASK' },
    ]);

    const itemsRes = await request(app)
      .get('/api/items')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(loginRes.status).toBe(200);
    expect(itemsRes.status).toBe(200);
    expect(itemsRes.body.length).toBe(1);
  });
});

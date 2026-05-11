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

import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret';
process.env.WEBHOOK_ENCRYPTION_KEY = 'test-webhook-encryption-key';
process.env.ATTACHMENT_MAX_SIZE_BYTES = '16';
process.env.MINIO_ACCESS_KEY = 'test-access';
process.env.MINIO_SECRET_KEY = 'test-secret';

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    upload: vi.fn(),
    remove: vi.fn(),
    createSignedDownloadUrl: vi.fn(),
  },
}));

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
      count: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
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
    team: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    teamMember: {
      deleteMany: vi.fn(),
    },
    teamProject: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    item: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    sprint: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workflowStatus: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    workflow: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    sprintScopeChange: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    sprintSnapshot: {
      upsert: vi.fn(),
    },
    webhook: {
      findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(),
    },
    webhookDelivery: {
      findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
    },
    domainEventOutbox: {
      findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
    },
    projectRepository: {
      findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(),
    },
    itemCodeLink: {
      findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(),
    },
    workflowTransition: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    savedView: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    bugDetails: {
      upsert: vi.fn(),
    },
    bugRetest: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    customField: {
      findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(),
    },
    customFieldOption: {
      findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(),
    },
    customFieldValue: {
      upsert: vi.fn(), deleteMany: vi.fn(),
    },
    comment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    itemHistory: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    itemWatcher: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    attachment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../src/infrastructure/db', () => ({
  prisma: prismaMock,
}));

vi.mock('../src/infrastructure/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/infrastructure/storage')>();
  return { ...actual, createObjectStorageService: () => storageMock };
});

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
  }, 30_000);

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((operation: any) => Array.isArray(operation)
      ? Promise.all(operation)
      : operation(prismaMock));
    prismaMock.itemHistory.create.mockResolvedValue({ id: 'history-1' });
    prismaMock.itemWatcher.findUnique.mockResolvedValue(null);
    prismaMock.itemWatcher.findMany.mockResolvedValue([]);
    prismaMock.itemWatcher.create.mockResolvedValue({
      id: 'watcher-1', item_id: 'item-1', user_id: 'user-1', createdAt: new Date(),
      user: { id: 'user-1', name: 'Admin', email: 'user@miniagil.com' },
    });
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.notification.createMany.mockResolvedValue({ count: 0 });
    prismaMock.workflowTransition.count.mockResolvedValue(0);
    prismaMock.workflowStatus.findMany.mockResolvedValue([]);
    prismaMock.customField.findMany.mockResolvedValue([]);
    prismaMock.item.findMany.mockResolvedValue([]);
    prismaMock.sprintScopeChange.findMany.mockResolvedValue([]);
    prismaMock.sprintSnapshot.upsert.mockResolvedValue({ id: 'snapshot-1' });
    prismaMock.domainEventOutbox.create.mockResolvedValue({ id: 'event-1' });
    storageMock.upload.mockResolvedValue({ bucket: 'private-attachments', objectKey: 'items/item-1/random.txt' });
    storageMock.remove.mockResolvedValue(undefined);
    storageMock.createSignedDownloadUrl.mockResolvedValue('http://minio/signed-download');
  });

  it('allows a project user to follow an item and records the watcher event', async () => {
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const res = await request(app)
      .post('/api/items/item-1/watchers/me')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe('user-1');
    expect(prismaMock.itemWatcher.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { item_id: 'item-1', user_id: 'user-1' },
    }));
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event_type: 'WATCHER_ADDED' }),
    });
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });

  it('blocks a user outside the project from following an item', async () => {
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'USER' });
    prismaMock.projectMember.findFirst.mockResolvedValueOnce(null);
    prismaMock.teamProject.findFirst.mockResolvedValueOnce(null);
    prismaMock.project.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/items/item-1/watchers/me')
      .set('Authorization', `Bearer ${makeToken('USER')}`);

    expect(res.status).toBe(404);
    expect(prismaMock.itemWatcher.create).not.toHaveBeenCalled();
  });

  it('lists watchers and lets the current user stop following', async () => {
    prismaMock.item.findUnique
      .mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' })
      .mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.itemWatcher.findMany.mockResolvedValueOnce([{
      id: 'watcher-1', item_id: 'item-1', user_id: 'user-1', createdAt: new Date(),
      user: { id: 'user-1', name: 'Admin', email: 'user@miniagil.com' },
    }]);
    prismaMock.itemWatcher.findUnique.mockResolvedValueOnce({ id: 'watcher-1', item_id: 'item-1', user_id: 'user-1' });
    prismaMock.itemWatcher.delete.mockResolvedValueOnce({ id: 'watcher-1' });

    const listRes = await request(app)
      .get('/api/items/item-1/watchers')
      .set('Authorization', `Bearer ${makeToken()}`);
    const deleteRes = await request(app)
      .delete('/api/items/item-1/watchers/me')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body[0].user.name).toBe('Admin');
    expect(deleteRes.status).toBe(204);
    expect(prismaMock.itemWatcher.delete).toHaveBeenCalledWith({ where: { id: 'watcher-1' } });
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event_type: 'WATCHER_REMOVED' }),
    });
  });

  it('notifies an assigned user but never the author of the action', async () => {
    prismaMock.item.findFirst.mockResolvedValueOnce({
      id: 'item-1', type: 'TASK', project_id: 'project-1', title: 'Tarefa', description: null,
      priority: 'MEDIUM', estimate: null, acceptance_criteria: null,
      workflow_status: { id: 'status-1', name: 'A Fazer' }, assignee: null, sprint: null,
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.item.update.mockResolvedValueOnce({
      id: 'item-1', type: 'TASK', project_id: 'project-1', title: 'Tarefa', description: null,
      priority: 'MEDIUM', estimate: null, acceptance_criteria: null,
      workflow_status: { id: 'status-1', name: 'A Fazer' },
      assignee: { id: 'user-2', name: 'Ana' }, sprint: null, parent: null, children: [],
    });
    prismaMock.item.findUnique.mockResolvedValueOnce({ project_key: 'MINI-1', title: 'Tarefa' });
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'user-2' }]);

    const res = await request(app)
      .patch('/api/items/item-1')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ assignee_id: 'user-2' });

    expect(res.status).toBe(200);
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ user_id: 'user-2', actor_id: 'user-1', type: 'ITEM_ASSIGNED' })],
    });
    expect(prismaMock.notification.createMany).not.toHaveBeenCalledWith({
      data: expect.arrayContaining([expect.objectContaining({ user_id: 'user-1' })]),
    });
  });

  it('lists and counts only the authenticated user notifications', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.notification.findMany.mockResolvedValueOnce([{ id: 'notification-1', readAt: null }]);
    prismaMock.notification.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const listRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${makeToken()}`);
    const countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.pagination.total).toBe(1);
    expect(countRes.body).toEqual({ count: 1 });
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ user_id: 'user-1' }),
    }));
  });

  it('marks one notification and all remaining notifications as read', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.notification.findFirst.mockResolvedValueOnce({ id: 'notification-1', user_id: 'user-1', readAt: null });
    prismaMock.notification.update.mockResolvedValueOnce({ id: 'notification-1', readAt: new Date() });
    prismaMock.notification.updateMany.mockResolvedValueOnce({ count: 2 });

    const oneRes = await request(app)
      .patch('/api/notifications/notification-1/read')
      .set('Authorization', `Bearer ${makeToken()}`);
    const allRes = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(oneRes.status).toBe(200);
    expect(allRes.body).toEqual({ updated: 2 });
    expect(prismaMock.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-1' }, data: { readAt: expect.any(Date) },
    });
  });

  it('does not allow reading another user notification', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.notification.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .patch('/api/notifications/notification-other/read')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(404);
    expect(prismaMock.notification.update).not.toHaveBeenCalled();
  });

  it('uploads a valid attachment and records its metadata and history', async () => {
    const createdAt = new Date('2026-08-03T12:00:00Z');
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.attachment.create.mockResolvedValueOnce({
      id: 'attachment-1', item_id: 'item-1', user_id: 'user-1',
      original_name: 'note.txt', fileName: 'note.txt', mime_type: 'text/plain',
      size_bytes: BigInt(8), checksum: 'sha256:test', createdAt,
      user: { id: 'user-1', name: 'Admin', email: 'user@miniagil.com' },
    });

    const res = await request(app)
      .post('/api/items/item-1/attachments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .attach('file', Buffer.from('miniagil'), { filename: 'note.txt', contentType: 'text/plain' });

    expect(res.status).toBe(201);
    expect(res.body.fileName).toBe('note.txt');
    expect(res.body).not.toHaveProperty('object_key');
    expect(storageMock.upload).toHaveBeenCalledWith(expect.stringMatching(/^items\/item-1\/[\w-]+\.txt$/), expect.any(Buffer), 8, 'text/plain');
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event_type: 'ATTACHMENT_UPLOADED', item_id: 'item-1' }),
    });
  });

  it('rejects a disallowed attachment type before storage', async () => {
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const res = await request(app)
      .post('/api/items/item-1/attachments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .attach('file', Buffer.from('binary'), { filename: 'malware.exe', contentType: 'application/octet-stream' });

    expect(res.status).toBe(415);
    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it('rejects an attachment over the configured maximum size', async () => {
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const res = await request(app)
      .post('/api/items/item-1/attachments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .attach('file', Buffer.alloc(17, 65), { filename: 'large.txt', contentType: 'text/plain' });

    expect(res.status).toBe(413);
    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it('blocks attachment upload for users without project access', async () => {
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'USER' });
    prismaMock.projectMember.findFirst.mockResolvedValueOnce(null);
    prismaMock.teamProject.findFirst.mockResolvedValueOnce(null);
    prismaMock.project.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/items/item-1/attachments')
      .set('Authorization', `Bearer ${makeToken('USER')}`)
      .attach('file', Buffer.from('miniagil'), { filename: 'note.txt', contentType: 'text/plain' });

    expect(res.status).toBe(404);
    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it('returns a signed download URL only after authorization', async () => {
    prismaMock.attachment.findFirst.mockResolvedValueOnce({
      id: 'attachment-1', item_id: 'item-1', user_id: 'user-1', bucket: 'private-attachments',
      object_key: 'items/item-1/random.txt', original_name: 'note.txt', fileName: 'note.txt',
      mime_type: 'text/plain', size_bytes: BigInt(8), item: { project_id: 'project-1' },
    });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const res = await request(app)
      .get('/api/attachments/attachment-1/download')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('http://minio/signed-download');
    expect(storageMock.createSignedDownloadUrl).toHaveBeenCalledWith('items/item-1/random.txt', 'private-attachments');
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event_type: 'ATTACHMENT_DOWNLOADED' }),
    });
  });

  it('lists attachment metadata without exposing storage references', async () => {
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.attachment.findMany.mockResolvedValueOnce([{
      id: 'attachment-1', item_id: 'item-1', user_id: 'user-1',
      original_name: 'note.txt', fileName: 'note.txt', mime_type: 'text/plain',
      size_bytes: BigInt(8), checksum: 'sha256:test', createdAt: new Date(),
      user: { id: 'user-1', name: 'Admin', email: 'user@miniagil.com' },
    }]);

    const res = await request(app)
      .get('/api/items/item-1/attachments')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.permissions).toEqual({ canUpload: true });
    expect(res.body.data[0].fileName).toBe('note.txt');
    expect(res.body.data[0].canDelete).toBe(true);
    expect(res.body.data[0]).not.toHaveProperty('bucket');
    expect(res.body.data[0]).not.toHaveProperty('object_key');
    expect(res.body.data[0]).not.toHaveProperty('url');
  });

  it('does not disclose a signed URL to a user outside the project', async () => {
    prismaMock.attachment.findFirst.mockResolvedValueOnce({
      id: 'attachment-1', item_id: 'item-1', user_id: 'user-1', bucket: 'private-attachments',
      object_key: 'items/item-1/random.txt', original_name: 'note.txt', fileName: 'note.txt',
      mime_type: 'text/plain', size_bytes: BigInt(8), item: { project_id: 'project-1' },
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'USER' });
    prismaMock.projectMember.findFirst.mockResolvedValueOnce(null);
    prismaMock.teamProject.findFirst.mockResolvedValueOnce(null);
    prismaMock.project.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/attachments/attachment-1/download')
      .set('Authorization', `Bearer ${makeToken('USER')}`);

    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('url');
    expect(storageMock.createSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('soft deletes an attachment and records history for its author', async () => {
    prismaMock.attachment.findFirst.mockResolvedValueOnce({
      id: 'attachment-1', item_id: 'item-1', user_id: 'user-1', bucket: 'private-attachments',
      object_key: 'items/item-1/random.txt', original_name: 'note.txt', fileName: 'note.txt',
      mime_type: 'text/plain', size_bytes: BigInt(8), item: { project_id: 'project-1' },
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.attachment.update.mockResolvedValueOnce({ id: 'attachment-1' });

    const res = await request(app)
      .delete('/api/attachments/attachment-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(204);
    expect(prismaMock.attachment.update).toHaveBeenCalledWith({
      where: { id: 'attachment-1' }, data: { deletedAt: expect.any(Date) },
    });
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event_type: 'ATTACHMENT_DELETED' }),
    });
  });

  it('does not persist metadata when MinIO upload fails', async () => {
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    storageMock.upload.mockRejectedValueOnce(new Error('MinIO unavailable'));

    const res = await request(app)
      .post('/api/items/item-1/attachments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .attach('file', Buffer.from('miniagil'), { filename: 'note.txt', contentType: 'text/plain' });

    expect(res.status).toBe(500);
    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
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
    prismaMock.workflowStatus.findUnique.mockResolvedValueOnce({
      id: 'status-1', name: 'A FAZER', workflow: { project_id: 'project-1', item_type: 'EPIC' },
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
      project_id: 'project-1',
    });
    prismaMock.item.findUniqueOrThrow.mockResolvedValueOnce({ id: 'item-2', project_key: 'MINI-2', title: 'Nova tarefa', type: 'EPIC', project_id: 'project-1', custom_field_values: [] });
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
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        item_id: 'item-2',
        project_id: 'project-1',
        user_id: 'user-1',
        event_type: 'ITEM_CREATED',
      }),
    });
  });

  it('creates a BUG with validated details in the item transaction', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'project-1', key_prefix: 'MINI' });
    prismaMock.workflowStatus.findUnique.mockResolvedValueOnce({
      id: 'bug-status', workflow: { project_id: 'project-1', item_type: 'BUG' },
    });
    prismaMock.$queryRaw.mockResolvedValueOnce([{ id: 'project-1', key_prefix: 'MINI', next_item_number: 3 }]);
    prismaMock.item.create.mockResolvedValueOnce({
      id: 'bug-1', project_key: 'MINI-3', title: 'Falha crítica', type: 'BUG', project_id: 'project-1',
      bug_details: { severity: 'BLOCKER', environment: 'PRODUCTION', origin: 'MONITORING', reproducibility: 'ALWAYS' },
    });
    prismaMock.item.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'bug-1', project_key: 'MINI-3', title: 'Falha crÃ­tica', type: 'BUG', project_id: 'project-1',
      bug_details: { severity: 'BLOCKER', environment: 'PRODUCTION' }, custom_field_values: [],
    });
    prismaMock.project.update.mockResolvedValueOnce({ id: 'project-1' });

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        type: 'BUG', title: 'Falha crítica', project_id: 'project-1', workflow_status_id: 'bug-status',
        bug_details: {
          severity: 'BLOCKER', environment: 'PRODUCTION', origin: 'MONITORING', reproducibility: 'ALWAYS',
          reproduction_steps: 'Executar rotina', regression: true,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.bug_details.severity).toBe('BLOCKER');
    expect(prismaMock.item.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'BUG',
        bug_details: { create: expect.objectContaining({ severity: 'BLOCKER', environment: 'PRODUCTION', regression: true }) },
      }),
      include: expect.objectContaining({ bug_details: true }),
    }));
  });

  it('rejects bug details for an item that is not a BUG', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'project-1', key_prefix: 'MINI' });

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ type: 'EPIC', title: 'Épico', project_id: 'project-1', workflow_status_id: 'status-1', bug_details: { severity: 'HIGH' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Only BUG items can have bug_details');
    expect(prismaMock.item.create).not.toHaveBeenCalled();
  });

  it('rejects story points outside stories and outside the allowed scale', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', key_prefix: 'MINI' });

    const taskResponse = await request(app).post('/api/items').set('Authorization', `Bearer ${makeToken()}`).send({
      type: 'TASK', title: 'Tarefa', project_id: 'project-1', workflow_status_id: 'status-1', story_points: 5,
    });
    const storyResponse = await request(app).post('/api/items').set('Authorization', `Bearer ${makeToken()}`).send({
      type: 'STORY', title: 'História', project_id: 'project-1', workflow_status_id: 'status-1', story_points: 4,
    });

    expect(taskResponse.status).toBe(400);
    expect(taskResponse.body.error).toContain('only allowed for STORY');
    expect(storyResponse.status).toBe(400);
    expect(storyResponse.body.error).toContain('1, 2, 3, 5, 8, 13, 20');
  });

  it('records story point changes as estimation history', async () => {
    prismaMock.item.findFirst.mockResolvedValue({
      id: 'story-1', type: 'STORY', project_id: 'project-1', title: 'História', description: null,
      priority: 'MEDIUM', estimate: null, story_points: 3, acceptance_criteria: null,
      workflow_status: { id: 'status-1', name: 'Backlog', workflow_id: 'workflow-story' }, assignee: null, sprint: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.item.update.mockResolvedValue({
      id: 'story-1', type: 'STORY', project_id: 'project-1', title: 'História', description: null,
      priority: 'MEDIUM', estimate: null, story_points: 5, acceptance_criteria: null,
      workflow_status: { id: 'status-1', name: 'Backlog', workflow_id: 'workflow-story' }, assignee: null, sprint: null,
      custom_field_values: [], children: [], parent: null,
    });

    const res = await request(app).patch('/api/items/story-1').set('Authorization', `Bearer ${makeToken()}`).send({ story_points: 5 });

    expect(res.status).toBe(200);
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      event_type: 'ESTIMATE_CHANGED', field: 'story_points', old_value: { value: 3 }, new_value: { value: 5 },
    }) });
  });

  it('validates required custom fields when creating an item', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', key_prefix: 'MINI' });
    prismaMock.workflowStatus.findUnique.mockResolvedValue({ id: 'status-1', workflow: { project_id: 'project-1', item_type: 'EPIC' } });
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'project-1', key_prefix: 'MINI', next_item_number: 4 }]);
    prismaMock.item.create.mockResolvedValue({ id: 'item-custom', project_key: 'MINI-4', type: 'EPIC', project_id: 'project-1' });
    prismaMock.customField.findMany.mockResolvedValue([{ id: 'field-required', name: 'Contrato', field_type: 'TEXT', is_required: true }]);

    const res = await request(app).post('/api/items').set('Authorization', `Bearer ${makeToken()}`).send({
      type: 'EPIC', title: 'Com campo', project_id: 'project-1', workflow_status_id: 'status-1', custom_fields: {},
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Contrato is required');
    expect(prismaMock.customFieldValue.upsert).not.toHaveBeenCalled();
  });

  it('rejects a SELECT custom field value outside its active options', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', key_prefix: 'MINI' });
    prismaMock.workflowStatus.findUnique.mockResolvedValue({ id: 'status-1', workflow: { project_id: 'project-1', item_type: 'EPIC' } });
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'project-1', key_prefix: 'MINI', next_item_number: 5 }]);
    prismaMock.item.create.mockResolvedValue({ id: 'item-custom', project_key: 'MINI-5', type: 'EPIC', project_id: 'project-1' });
    prismaMock.customField.findMany.mockResolvedValue([{ id: 'field-select', name: 'Canal', field_type: 'SELECT', is_required: false }]);
    prismaMock.customFieldOption.findFirst.mockResolvedValue(null);

    const res = await request(app).post('/api/items').set('Authorization', `Bearer ${makeToken()}`).send({
      type: 'EPIC', title: 'Com campo', project_id: 'project-1', workflow_status_id: 'status-1', custom_fields: { 'field-select': 'INVALID' },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('valid option');
  });

  it('filters items through an enabled custom field', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.customField.findFirst.mockResolvedValue({ id: 'field-1', field_type: 'SELECT' });
    prismaMock.item.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/items?project_id=project-1&type=BUG&custom_field_id=field-1&custom_field_value=API')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(prismaMock.item.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      custom_field_values: { some: { field_id: 'field-1', value: { equals: 'API' } } },
    }) }));
  });

  it('updates BUG details with an upsert inside the existing item transaction', async () => {
    prismaMock.item.findFirst.mockResolvedValueOnce({
      id: 'bug-1', type: 'BUG', project_id: 'project-1', title: 'Bug', description: null, priority: 'HIGH',
      estimate: null, acceptance_criteria: null, workflow_status: { id: 'status-1', name: 'A fazer', workflow_id: 'workflow-1' },
      assignee: null, sprint: null,
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.bugDetails.upsert.mockResolvedValueOnce({ id: 'details-1', severity: 'CRITICAL' });
    prismaMock.item.update.mockResolvedValueOnce({
      id: 'bug-1', type: 'BUG', project_id: 'project-1', title: 'Bug', description: null, priority: 'HIGH',
      estimate: null, acceptance_criteria: null, workflow_status: { id: 'status-1', name: 'A fazer' },
      assignee: null, sprint: null, parent: null, children: [], bug_details: { severity: 'CRITICAL', reopened_count: 2 },
    });

    const res = await request(app)
      .patch('/api/items/bug-1')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ bug_details: { severity: 'CRITICAL', reopened_count: 2 } });

    expect(res.status).toBe(200);
    expect(res.body.bug_details.reopened_count).toBe(2);
    expect(prismaMock.bugDetails.upsert).toHaveBeenCalledWith({
      where: { item_id: 'bug-1' },
      create: { item_id: 'bug-1', severity: 'CRITICAL', reopened_count: 2 },
      update: { severity: 'CRITICAL', reopened_count: 2 },
    });
  });

  it('lists only BUG items with severity, environment, assignee and status filters', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.item.findMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/items?project_id=project-1&type=BUG&severity=CRITICAL,BLOCKER&environment=PRODUCTION&assignee_id=user-2&status_id=status-2&board=true')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(prismaMock.item.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        project_id: 'project-1', type: 'BUG', assignee_id: 'user-2', workflow_status_id: 'status-2',
        bug_details: { is: { severity: { in: ['CRITICAL', 'BLOCKER'] }, environment: 'PRODUCTION' } },
      }),
      orderBy: [
        { workflow_status_id: 'asc' },
        { board_position: 'asc' },
        { createdAt: 'asc' },
      ],
    }));
  });

  it('rejects an invalid bug severity filter in a controlled way', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const res = await request(app)
      .get('/api/items?project_id=project-1&type=BUG&severity=UNKNOWN')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid bug severity');
    expect(prismaMock.item.findMany).not.toHaveBeenCalled();
  });

  it('records an approved bug retest and its history', async () => {
    const bug = {
      id: 'bug-1', type: 'BUG', project_id: 'project-1', assignee_id: 'user-2',
      workflow_status: { id: 'retest-status', name: 'Em reteste', workflow_id: 'bug-workflow' },
      bug_details: { reopened_count: 0 },
    };
    prismaMock.item.findUnique.mockResolvedValue(bug);
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.bugRetest.create.mockResolvedValue({
      id: 'retest-1', bug_id: 'bug-1', tester_id: 'user-1', environment: 'HOMOLOGATION',
      result: 'APPROVED', observations: 'Fluxo validado', createdAt: new Date(),
      tester: { id: 'user-1', name: 'Admin', email: 'user@miniagil.com' },
    });

    const res = await request(app).post('/api/items/bug-1/retests')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ environment: 'HOMOLOGATION', result: 'APPROVED', observations: 'Fluxo validado' });

    expect(res.status).toBe(201);
    expect(res.body.result).toBe('APPROVED');
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ event_type: 'BUG_RETEST_RECORDED' }) });
    expect(prismaMock.item.update).not.toHaveBeenCalled();
  });

  it('reopens a bug after a failed retest through workflow validation', async () => {
    const bug = {
      id: 'bug-1', type: 'BUG', project_id: 'project-1', assignee_id: 'user-2',
      workflow_status: { id: 'retest-status', name: 'Em reteste', workflow_id: 'bug-workflow' },
      bug_details: { reopened_count: 2 },
    };
    prismaMock.item.findUnique.mockResolvedValue(bug);
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.workflowStatus.findUnique.mockResolvedValue({ id: 'reopened-status', name: 'Reaberto', category: 'IN_PROGRESS', workflow_id: 'bug-workflow', is_active: true });
    prismaMock.bugRetest.create.mockResolvedValue({
      id: 'retest-2', bug_id: 'bug-1', tester_id: 'user-1', environment: 'TEST',
      result: 'FAILED', observations: 'Erro persiste', createdAt: new Date(),
      tester: { id: 'user-1', name: 'Admin', email: 'user@miniagil.com' },
    });
    prismaMock.bugDetails.upsert.mockResolvedValue({ reopened_count: 3 });
    prismaMock.item.update.mockResolvedValue({ id: 'bug-1' });

    const res = await request(app).post('/api/items/bug-1/retests')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ environment: 'TEST', result: 'FAILED', observations: 'Erro persiste', target_status_id: 'reopened-status' });

    expect(res.status).toBe(201);
    expect(prismaMock.workflowTransition.count).toHaveBeenCalledWith({ where: { workflow_id: 'bug-workflow', is_active: true } });
    expect(prismaMock.item.update).toHaveBeenCalledWith({ where: { id: 'bug-1' }, data: { workflow_status_id: 'reopened-status' } });
    expect(prismaMock.bugDetails.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { reopened_count: { increment: 1 } } }));
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ event_type: 'BUG_REOPENED', new_value: { value: 3 } }) });
  });

  it('denies bug retest access outside the project', async () => {
    prismaMock.item.findUnique.mockResolvedValue({ id: 'bug-1', type: 'BUG', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'USER' });
    prismaMock.projectMember.findFirst.mockResolvedValue(null);
    prismaMock.teamProject.findFirst.mockResolvedValue(null);
    prismaMock.project.findFirst.mockResolvedValue(null);

    const res = await request(app).post('/api/items/bug-1/retests')
      .set('Authorization', `Bearer ${makeToken('USER')}`)
      .send({ environment: 'TEST', result: 'NOT_TESTED' });

    expect(res.status).toBe(404);
    expect(prismaMock.bugRetest.create).not.toHaveBeenCalled();
  });

  it('does not allow retests on non-BUG items', async () => {
    prismaMock.item.findUnique.mockResolvedValue({ id: 'task-1', type: 'TASK', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const res = await request(app).post('/api/items/task-1/retests')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ environment: 'TEST', result: 'NOT_TESTED' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only BUG items');
    expect(prismaMock.bugRetest.create).not.toHaveBeenCalled();
  });

  it('creates default workflows for every item type with a new project', async () => {
    prismaMock.project.findUnique.mockResolvedValueOnce(null);
    prismaMock.project.create.mockResolvedValueOnce({
      id: 'project-new', name: 'Novo Projeto', key_prefix: 'NEW', description: null,
      owner_id: 'user-1', createdAt: new Date(), updatedAt: new Date(),
    });
    prismaMock.workflow.create.mockResolvedValue({ id: 'workflow-new' });

    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'Novo Projeto', key_prefix: 'NEW' });

    expect(res.status).toBe(201);
    expect(prismaMock.workflow.create).toHaveBeenCalledTimes(5);
    expect(prismaMock.workflow.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'project-new', item_type: 'BUG', is_default: true,
        statuses: { create: expect.arrayContaining([
          expect.objectContaining({ name: 'Registrado', is_initial: true }),
          expect.objectContaining({ name: 'Pronto para reteste' }),
          expect.objectContaining({ name: 'Fechado', is_final: true }),
          expect.objectContaining({ name: 'Reaberto' }),
        ]) },
      }),
    });
  });

  it('records status and assignee changes with identifiers and names', async () => {
    prismaMock.item.findFirst.mockResolvedValueOnce({
      id: 'item-1',
      type: 'TASK',
      project_id: 'project-1',
      title: 'Tarefa',
      description: null,
      priority: 'MEDIUM',
      estimate: null,
      acceptance_criteria: null,
      workflow_status: { id: 'status-1', name: 'A FAZER', workflow_id: 'workflow-1' },
      assignee: null,
      sprint: null,
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.workflowStatus.findUnique
      .mockResolvedValueOnce({
        id: 'status-2', name: 'EM PROGRESSO', workflow_id: 'workflow-1', workflow: { project_id: 'project-1', item_type: 'TASK' },
      })
      .mockResolvedValueOnce({ id: 'status-2', workflow_id: 'workflow-1', is_active: true });
    prismaMock.item.update.mockResolvedValueOnce({
      id: 'item-1',
      type: 'TASK',
      project_id: 'project-1',
      title: 'Tarefa',
      description: null,
      priority: 'MEDIUM',
      estimate: null,
      acceptance_criteria: null,
      workflow_status: { id: 'status-2', name: 'EM PROGRESSO' },
      assignee: { id: 'user-2', name: 'Ana' },
      sprint: null,
      parent: null,
      children: [],
    });

    const res = await request(app)
      .patch('/api/items/item-1')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ workflow_status_id: 'status-2', assignee_id: 'user-2' });

    expect(res.status).toBe(200);
    expect(prismaMock.itemHistory.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event_type: 'STATUS_CHANGED',
        field: 'workflow_status_id',
        old_value: { id: 'status-1', name: 'A FAZER' },
        new_value: { id: 'status-2', name: 'EM PROGRESSO' },
      }),
    });
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event_type: 'ASSIGNEE_CHANGED',
        field: 'assignee_id',
        old_value: { id: null, name: null },
        new_value: { id: 'user-2', name: 'Ana' },
      }),
    });
  });

  it('blocks a status change when no configured transition matches', async () => {
    prismaMock.item.findFirst.mockResolvedValueOnce({
      id: 'item-1', type: 'TASK', project_id: 'project-1', title: 'Tarefa', description: null,
      priority: 'MEDIUM', estimate: null, acceptance_criteria: null,
      workflow_status: { id: 'status-1', name: 'A fazer', workflow_id: 'workflow-1' },
      assignee: null, sprint: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.workflowStatus.findUnique
      .mockResolvedValueOnce({ id: 'status-2', workflow_id: 'workflow-1', workflow: { project_id: 'project-1', item_type: 'TASK' } })
      .mockResolvedValueOnce({ id: 'status-2', workflow_id: 'workflow-1', is_active: true });
    prismaMock.workflowTransition.count.mockResolvedValueOnce(1);
    prismaMock.workflowTransition.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .patch('/api/items/item-1')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ workflow_status_id: 'status-2' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Transition is not allowed');
    expect(prismaMock.item.update).not.toHaveBeenCalled();
  });

  it('validates assignee and stores a required transition comment atomically', async () => {
    prismaMock.item.findFirst.mockResolvedValueOnce({
      id: 'item-1', type: 'TASK', project_id: 'project-1', title: 'Tarefa', description: null,
      priority: 'MEDIUM', estimate: null, acceptance_criteria: null,
      workflow_status: { id: 'status-1', name: 'A fazer', workflow_id: 'workflow-1' },
      assignee: null, sprint: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.workflowStatus.findUnique
      .mockResolvedValueOnce({ id: 'status-2', workflow_id: 'workflow-1', workflow: { project_id: 'project-1', item_type: 'TASK' } })
      .mockResolvedValueOnce({ id: 'status-2', workflow_id: 'workflow-1', is_active: true });
    prismaMock.workflowTransition.count.mockResolvedValueOnce(1);
    prismaMock.workflowTransition.findFirst.mockResolvedValueOnce({
      id: 'transition-1', requires_assignee: true, requires_comment: true,
    });
    prismaMock.item.update.mockResolvedValueOnce({
      id: 'item-1', project_id: 'project-1', title: 'Tarefa', description: null, priority: 'MEDIUM',
      estimate: null, acceptance_criteria: null, workflow_status: { id: 'status-2', name: 'Em andamento' },
      assignee: { id: 'user-2', name: 'Ana' }, sprint: null, parent: null, children: [],
    });
    prismaMock.comment.create.mockResolvedValueOnce({ id: 'comment-transition', text: 'Pronto para iniciar' });

    const res = await request(app)
      .patch('/api/items/item-1')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ workflow_status_id: 'status-2', assignee_id: 'user-2', transition_comment: 'Pronto para iniciar' });

    expect(res.status).toBe(200);
    expect(prismaMock.comment.create).toHaveBeenCalledWith({
      data: { text: 'Pronto para iniciar', user_id: 'user-1', item_id: 'item-1' },
    });
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event_type: 'STATUS_CHANGED' }),
    });
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ event_type: 'COMMENT_CREATED' }),
    });
  });

  it('lists item history with pagination and newest records first', async () => {
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.itemHistory.findMany.mockResolvedValueOnce([
      { id: 'history-2', event_type: 'TITLE_CHANGED', createdAt: new Date('2026-08-03T12:00:00Z') },
    ]);
    prismaMock.itemHistory.count.mockResolvedValueOnce(3);

    const res = await request(app)
      .get('/api/items/item-1/history?page=2&limit=2')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(prismaMock.itemHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { item_id: 'item-1' },
        orderBy: { createdAt: 'desc' },
        skip: 2,
        take: 2,
      })
    );
  });

  it('blocks item history access for users outside the project', async () => {
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'USER' });
    prismaMock.projectMember.findFirst.mockResolvedValueOnce(null);
    prismaMock.teamProject.findFirst.mockResolvedValueOnce(null);
    prismaMock.project.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/items/item-1/history')
      .set('Authorization', `Bearer ${makeToken('USER')}`);

    expect(res.status).toBe(404);
    expect(prismaMock.itemHistory.findMany).not.toHaveBeenCalled();
  });

  it('lists active comments in chronological order', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.comment.findMany.mockResolvedValueOnce([
      {
        id: 'comment-1',
        text: 'Primeiro comentário',
        user_id: 'user-1',
        item_id: 'item-1',
        createdAt,
        updatedAt: createdAt,
        editedAt: null,
        deletedAt: null,
        user: { id: 'user-1', name: 'Admin', email: 'user@miniagil.com' },
      },
    ]);

    const res = await request(app)
      .get('/api/items/item-1/comments')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body[0].isEdited).toBe(false);
    expect(res.body[0].user.name).toBe('Admin');
    expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { item_id: 'item-1', deletedAt: null },
        orderBy: { createdAt: 'asc' },
      })
    );
  });

  it('creates a comment for a user with project access', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.comment.create.mockResolvedValueOnce({
      id: 'comment-1',
      text: 'Novo comentário',
      user_id: 'user-1',
      item_id: 'item-1',
      createdAt,
      updatedAt: createdAt,
      editedAt: null,
      deletedAt: null,
      user: { id: 'user-1', name: 'Admin', email: 'user@miniagil.com' },
    });

    const res = await request(app)
      .post('/api/items/item-1/comments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ text: '  Novo comentário  ' });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe('Novo comentário');
    expect(res.body.isEdited).toBe(false);
    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { text: 'Novo comentário', user_id: 'user-1', item_id: 'item-1' },
      })
    );
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        item_id: 'item-1',
        project_id: 'project-1',
        event_type: 'COMMENT_CREATED',
        metadata: { comment_id: 'comment-1' },
        new_value: { text: 'Novo comentário' },
      }),
    });
  });

  it('auto-follows the commenter and notifies other watchers about the new comment', async () => {
    const createdAt = new Date('2026-08-03T10:00:00.000Z');
    prismaMock.item.findUnique
      .mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' })
      .mockResolvedValueOnce({ project_key: 'MINI-1', title: 'Tarefa' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.comment.create.mockResolvedValueOnce({
      id: 'comment-1', text: 'Atualização', user_id: 'user-1', item_id: 'item-1',
      createdAt, updatedAt: createdAt, editedAt: null, deletedAt: null,
      user: { id: 'user-1', name: 'Admin', email: 'user@miniagil.com' },
    });
    prismaMock.itemWatcher.findMany.mockResolvedValueOnce([
      { user_id: 'user-1' },
      { user_id: 'user-2' },
    ]);
    prismaMock.user.findMany.mockResolvedValueOnce([{ id: 'user-2' }]);

    const res = await request(app)
      .post('/api/items/item-1/comments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ text: 'Atualização' });

    expect(res.status).toBe(201);
    expect(prismaMock.itemWatcher.create).toHaveBeenCalled();
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        user_id: 'user-2', actor_id: 'user-1', type: 'COMMENT_CREATED',
      })],
    });
  });

  it('rejects an empty comment', async () => {
    const res = await request(app)
      .post('/api/items/item-1/comments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ text: '   ' });

    expect(res.status).toBe(400);
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
  });

  it('fails the domain operation when history registration fails', async () => {
    const createdAt = new Date('2026-08-01T10:00:00.000Z');
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.comment.create.mockResolvedValueOnce({
      id: 'comment-1',
      text: 'Comentário transacional',
      user_id: 'user-1',
      item_id: 'item-1',
      createdAt,
      updatedAt: createdAt,
      editedAt: null,
      deletedAt: null,
      user: { id: 'user-1', name: 'Admin', email: 'user@miniagil.com' },
    });
    prismaMock.itemHistory.create.mockRejectedValueOnce(new Error('History unavailable'));

    const res = await request(app)
      .post('/api/items/item-1/comments')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ text: 'Comentário transacional' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('History unavailable');
  });

  it('allows the author to edit a comment', async () => {
    const editedAt = new Date('2026-08-02T10:00:00.000Z');
    prismaMock.comment.findFirst.mockResolvedValueOnce({
      id: 'comment-1',
      user_id: 'user-1',
      text: 'Texto anterior',
      item_id: 'item-1',
      item: { project_id: 'project-1' },
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'USER' });
    prismaMock.projectMember.findFirst.mockResolvedValueOnce({ role: 'MEMBER' });
    prismaMock.comment.update.mockResolvedValueOnce({
      id: 'comment-1',
      text: 'Texto editado',
      user_id: 'user-1',
      item_id: 'item-1',
      createdAt: editedAt,
      updatedAt: editedAt,
      editedAt,
      deletedAt: null,
      user: { id: 'user-1', name: 'Usuário', email: 'user@miniagil.com' },
    });

    const res = await request(app)
      .patch('/api/comments/comment-1')
      .set('Authorization', `Bearer ${makeToken('USER')}`)
      .send({ text: 'Texto editado' });

    expect(res.status).toBe(200);
    expect(res.body.isEdited).toBe(true);
    expect(prismaMock.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comment-1' },
        data: expect.objectContaining({ text: 'Texto editado', editedAt: expect.any(Date) }),
      })
    );
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event_type: 'COMMENT_EDITED',
        old_value: { text: 'Texto anterior' },
        new_value: { text: 'Texto editado' },
        metadata: { comment_id: 'comment-1' },
      }),
    });
  });

  it('soft deletes a comment without removing it physically', async () => {
    prismaMock.comment.findFirst.mockResolvedValueOnce({
      id: 'comment-1',
      user_id: 'user-2',
      text: 'Comentário removido',
      item_id: 'item-1',
      item: { project_id: 'project-1' },
    });
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.comment.update.mockResolvedValueOnce({ id: 'comment-1' });

    const res = await request(app)
      .delete('/api/comments/comment-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(204);
    expect(prismaMock.comment.update).toHaveBeenCalledWith({
      where: { id: 'comment-1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event_type: 'COMMENT_DELETED',
        old_value: { text: 'Comentário removido' },
        metadata: { comment_id: 'comment-1' },
      }),
    });
  });

  it('blocks comment creation when the user cannot access the project', async () => {
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'USER' });
    prismaMock.projectMember.findFirst.mockResolvedValueOnce(null);
    prismaMock.teamProject.findFirst.mockResolvedValueOnce(null);
    prismaMock.project.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/items/item-1/comments')
      .set('Authorization', `Bearer ${makeToken('USER')}`)
      .send({ text: 'Sem acesso' });

    expect(res.status).toBe(404);
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
  });

  it('blocks a regular member from editing another user comment', async () => {
    prismaMock.comment.findFirst.mockResolvedValueOnce({
      id: 'comment-1',
      user_id: 'user-2',
      text: 'Texto original',
      item_id: 'item-1',
      item: { project_id: 'project-1' },
    });
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ role: 'USER' })
      .mockResolvedValueOnce({ role: 'USER' });
    prismaMock.projectMember.findFirst
      .mockResolvedValueOnce({ role: 'MEMBER' })
      .mockResolvedValueOnce({ role: 'MEMBER' });

    const res = await request(app)
      .patch('/api/comments/comment-1')
      .set('Authorization', `Bearer ${makeToken('USER')}`)
      .send({ text: 'Tentativa indevida' });

    expect(res.status).toBe(403);
    expect(prismaMock.comment.update).not.toHaveBeenCalled();
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
    prismaMock.sprint.findUnique.mockResolvedValueOnce({
      id: 'sprint-1', project_id: 'project-1', status: 'PLANNED',
      startDate: new Date('2026-08-01'), endDate: new Date('2026-08-15'),
    });
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.sprint.findFirst.mockResolvedValueOnce(null);
    prismaMock.item.findMany.mockResolvedValueOnce([
      { story_points: 5, workflow_status: { category: 'DONE' } },
      { story_points: null, workflow_status: { category: 'TODO' } },
    ]);
    prismaMock.sprint.update
      .mockResolvedValueOnce({ id: 'sprint-1', initial_scope_points: 0 })
      .mockResolvedValueOnce({ id: 'sprint-1', status: 'ACTIVE' });

    const res = await request(app)
      .patch('/api/sprints/sprint-1/status')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(prismaMock.sprintSnapshot.upsert).toHaveBeenCalled();
    expect(prismaMock.sprint.update).toHaveBeenCalledWith({ where: { id: 'sprint-1' }, data: expect.objectContaining({ initial_scope_points: 6, initial_scope_items: 2 }) });
    expect(prismaMock.sprint.update).toHaveBeenCalledWith({ where: { id: 'sprint-1' }, data: expect.objectContaining({ status: 'ACTIVE', startedAt: expect.any(Date), started_by_id: 'user-1' }) });
  });

  it('finishes an active sprint transactionally and returns pending items to backlog', async () => {
    prismaMock.sprint.findFirst.mockResolvedValueOnce({ id: 'sprint-1', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.sprint.findUnique.mockResolvedValueOnce({ id: 'sprint-1', name: 'Sprint 1', project_id: 'project-1', status: 'ACTIVE' });
    prismaMock.item.findMany.mockResolvedValueOnce([{ id: 'story-pending', project_id: 'project-1' }]);
    prismaMock.item.update.mockResolvedValueOnce({ id: 'story-pending', sprint_id: null });
    prismaMock.sprint.update.mockResolvedValueOnce({ id: 'sprint-1', status: 'FINISHED' });

    const res = await request(app).patch('/api/sprints/sprint-1/status').set('Authorization', `Bearer ${makeToken()}`).send({
      status: 'FINISHED', pending_destination: 'BACKLOG',
    });

    expect(res.status).toBe(200);
    expect(res.body.movedItems).toBe(1);
    expect(prismaMock.item.findMany).toHaveBeenCalledWith({ where: { sprint_id: 'sprint-1', workflow_status: { category: { not: 'DONE' } } }, select: { id: true, project_id: true, project_key: true, title: true, story_points: true, type: true } });
    expect(prismaMock.item.update).toHaveBeenCalledWith({ where: { id: 'story-pending' }, data: { sprint_id: null } });
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ event_type: 'SPRINT_CHANGED', metadata: { reason: 'SPRINT_FINISHED' } }) });
    expect(prismaMock.sprint.update).toHaveBeenCalledWith({ where: { id: 'sprint-1' }, data: expect.objectContaining({ status: 'FINISHED', finishedAt: expect.any(Date), finished_by_id: 'user-1' }) });
  });

  it('returns persisted burndown totals and visible scope changes', async () => {
    const snapshot = { id: 'snap-1', snapshot_date: new Date('2026-08-03'), scope_points: 9, remaining_points: 4, completed_points: 5 };
    prismaMock.sprint.findUnique
      .mockResolvedValueOnce({ project_id: 'project-1' })
      .mockResolvedValueOnce({ status: 'FINISHED' })
      .mockResolvedValueOnce({ id: 'sprint-1', name: 'Sprint 1', status: 'FINISHED', startDate: new Date('2026-08-01'), endDate: new Date('2026-08-15'), initial_scope_points: 8, snapshots: [snapshot], scopeChanges: [
        { id: 'change-1', change_type: 'ADDED', points: 3, item_key: 'PRJ-2', item_title: 'Nova história', createdAt: new Date(), user: { id: 'user-1', name: 'Admin' } },
        { id: 'change-2', change_type: 'REMOVED', points: 2, item_key: 'PRJ-3', item_title: 'Retirada', createdAt: new Date(), user: { id: 'user-1', name: 'Admin' } },
      ] });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const res = await request(app).get('/api/sprints/sprint-1/metrics').set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual(expect.objectContaining({ plannedPoints: 8, currentScopePoints: 9, completedPoints: 5, addedPoints: 3, removedPoints: 2 }));
    expect(res.body.scopeChanges).toHaveLength(2);
    expect(res.body.calculation.unestimatedStoryFallbackPoints).toBe(1);
  });

  it('prevents a second active sprint and validates finish destination', async () => {
    prismaMock.sprint.findFirst.mockResolvedValueOnce({ id: 'sprint-2', project_id: 'project-1' });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.sprint.findUnique.mockResolvedValueOnce({ id: 'sprint-2', project_id: 'project-1', status: 'PLANNED', startDate: new Date('2026-08-16'), endDate: new Date('2026-08-30') });
    prismaMock.sprint.findFirst.mockResolvedValueOnce({ id: 'sprint-1' });
    const activeResponse = await request(app).patch('/api/sprints/sprint-2/status').set('Authorization', `Bearer ${makeToken()}`).send({ status: 'ACTIVE' });
    expect(activeResponse.status).toBe(409);

    prismaMock.sprint.findFirst.mockResolvedValueOnce({ id: 'sprint-1', project_id: 'project-1' });
    prismaMock.sprint.findUnique.mockResolvedValueOnce({ id: 'sprint-1', name: 'Sprint 1', project_id: 'project-1', status: 'ACTIVE' });
    const finishResponse = await request(app).patch('/api/sprints/sprint-1/status').set('Authorization', `Bearer ${makeToken()}`).send({ status: 'CLOSED' });
    expect(finishResponse.status).toBe(400);
    expect(finishResponse.body.error).toContain('destination');
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

  it('uses the current database role to give an admin global project access', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.project.findMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${makeToken('USER')}`);

    expect(res.status).toBe(200);
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it('removes global project access immediately after an admin is demoted', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'USER' });
    prismaMock.project.findMany.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${makeToken('ADMIN')}`);

    expect(res.status).toBe(200);
    expect(prismaMock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { owner_id: 'user-1' },
            { members: { some: { user_id: 'user-1' } } },
            { teams: { some: { team: { members: { some: { user_id: 'user-1' } } } } } },
          ],
        },
      })
    );
  });

  it('returns consolidated project dashboard using normalized workflow categories', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'project-1', name: 'MiniAgil', key_prefix: 'MINI' });
    prismaMock.item.count
      .mockResolvedValueOnce(20).mockResolvedValueOnce(7).mockResolvedValueOnce(5).mockResolvedValueOnce(3)
      .mockResolvedValueOnce(3).mockResolvedValueOnce(4).mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    prismaMock.sprint.findFirst.mockResolvedValueOnce({ id: 'sprint-1', name: 'Sprint atual', initial_scope_points: 13, items: [{ story_points: 8, workflow_status: { category: 'DONE' } }, { story_points: 5, workflow_status: { category: 'IN_PROGRESS' } }] });
    prismaMock.item.findMany.mockResolvedValueOnce([{ id: 'epic-1', project_key: 'MINI-1', title: 'Portal', children: [
      { workflow_status: { category: 'DONE' } }, { workflow_status: { category: 'IN_PROGRESS' } },
    ] }]);

    const res = await request(app)
      .get('/api/items/dashboard-metrics?project_id=project-1')
      .set('Authorization', `Bearer ${makeToken('USER')}`);

    expect(res.status).toBe(200);
    expect(res.body.metrics).toEqual(expect.objectContaining({ totalItems: 20, completedItems: 7, inProgressItems: 5, overdueItems: { value: 3, supported: true }, openBugs: 4, criticalBugs: 2, reopenedBugs: 1 }));
    expect(res.body.currentSprint).toEqual(expect.objectContaining({ plannedPoints: 13, completedPoints: 8 }));
    expect(res.body.epicProgress[0].percentage).toBe(50);
    expect(prismaMock.item.count).toHaveBeenCalledWith({ where: expect.objectContaining({ workflow_status: { category: 'DONE' } }) });
  });

  it('denies project dashboard access to a user outside the project', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'USER' });
    prismaMock.projectMember.findFirst.mockResolvedValueOnce(null);
    prismaMock.teamProject.findFirst.mockResolvedValueOnce(null);
    prismaMock.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/items/dashboard-metrics?project_id=project-1').set('Authorization', `Bearer ${makeToken('USER')}`);
    expect(res.status).toBe(404);
    expect(prismaMock.item.count).not.toHaveBeenCalled();
  });

  it('builds operational reports from filtered project items', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.item.findMany.mockResolvedValueOnce([
      { id: 'epic-1', project_key: 'MINI-1', type: 'EPIC', title: 'Portal', priority: 'HIGH', assignee_id: 'user-1', sprint_id: null, parent_id: null, story_points: null, createdAt: new Date(Date.now() - 5 * 86400000), updatedAt: new Date(), workflow_status: { id: 'done', name: 'Finalizado customizado', category: 'DONE' }, assignee: { name: 'Ana', email: 'ana@test.com' }, sprint: null, bug_details: null },
      { id: 'story-1', project_key: 'MINI-2', type: 'STORY', title: 'Login', priority: 'MEDIUM', assignee_id: null, sprint_id: null, parent_id: 'epic-1', story_points: 5, createdAt: new Date(), updatedAt: new Date(), workflow_status: { id: 'todo', name: 'Fila personalizada', category: 'TODO' }, assignee: null, sprint: null, bug_details: null },
      { id: 'bug-1', project_key: 'MINI-3', type: 'BUG', title: 'Falha', priority: 'CRITICAL', assignee_id: 'user-1', sprint_id: null, parent_id: null, story_points: null, createdAt: new Date(Date.now() - 10 * 86400000), updatedAt: new Date(), workflow_status: { id: 'doing', name: 'Investigando', category: 'IN_PROGRESS' }, assignee: { name: 'Ana', email: 'ana@test.com' }, sprint: null, bug_details: { severity: 'CRITICAL', environment: 'PRODUCTION', reopened_count: 2 } },
    ]);
    prismaMock.sprint.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/reports/operational?project_id=project-1').set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.epicProgress[0]).toEqual(expect.objectContaining({ total: 1, completed: 0, percentage: 0 }));
    expect(res.body.bugsBySeverity).toEqual([{ label: 'CRITICAL', count: 1 }]);
    expect(res.body.reopenedBugs).toBe(1);
    expect(res.body.averageOpenDays).toBeGreaterThanOrEqual(9.9);
  });

  it('streams UTF-8 CSV and neutralizes formula injection', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.item.findMany.mockResolvedValueOnce([{ id: 'item-1', project_key: 'MINI-1', type: 'TASK', title: '=HYPERLINK("bad")', priority: 'HIGH', assignee_id: null, sprint_id: null, parent_id: null, story_points: null, createdAt: new Date('2026-08-01'), updatedAt: new Date('2026-08-02'), workflow_status: { id: 'todo', name: '+Status', category: 'TODO' }, assignee: null, sprint: null, bug_details: null }]);
    const res = await request(app).get('/api/reports/export/items?project_id=project-1').set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('miniagil-items.csv');
    expect(res.text.charCodeAt(0)).toBe(0xFEFF);
    expect(res.text).toContain("'=HYPERLINK");
    expect(res.text).toContain("'+Status");
  });

  it('does not export reports from an unauthorized project', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'USER' }); prismaMock.projectMember.findFirst.mockResolvedValueOnce(null); prismaMock.teamProject.findFirst.mockResolvedValueOnce(null); prismaMock.project.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/reports/export/bugs?project_id=project-1').set('Authorization', `Bearer ${makeToken('USER')}`);
    expect(res.status).toBe(404); expect(prismaMock.item.findMany).not.toHaveBeenCalled();
  });

  it('creates a secure project webhook and returns its secret only once', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.webhook.create.mockResolvedValueOnce({ id: 'webhook-1', project_id: 'project-1', name: 'CI', url: 'https://93.184.216.34/hook', events: ['ITEM_CREATED'], is_active: true, createdAt: new Date(), updatedAt: new Date() });
    const res = await request(app).post('/api/projects/project-1/webhooks').set('Authorization', `Bearer ${makeToken()}`).send({ name: 'CI', url: 'https://93.184.216.34/hook', events: ['ITEM_CREATED'] });
    expect(res.status).toBe(201); expect(res.body.secret).toEqual(expect.any(String));
    expect(prismaMock.webhook.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ secret_encrypted: expect.not.stringContaining(res.body.secret) }), select: expect.not.objectContaining({ secret_encrypted: true }) }));
  });

  it('enqueues a versioned domain event once for matching webhooks', async () => {
    const { enqueueDomainEvent } = await import('../src/services/webhooks');
    prismaMock.webhook.findMany.mockResolvedValueOnce([{ id: 'webhook-1', events: ['ITEM_CREATED'] }]); prismaMock.webhookDelivery.create.mockResolvedValueOnce({ id: 'delivery-1' });
    await enqueueDomainEvent({ eventId: 'event-1', eventType: 'ITEM_CREATED', version: 1, occurredAt: new Date().toISOString(), actor: { id: 'user-1' }, project: { id: 'project-1' }, entity: { type: 'ITEM', id: 'item-1' }, payload: { projectKey: 'MINI-1' } });
    expect(prismaMock.webhookDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        webhook_id: 'webhook-1', event_id: 'event-1', event_type: 'item.created',
        payload: expect.objectContaining({ event: 'item.created', version: 1, actor: { id: 'user-1' }, project: { id: 'project-1' }, entity: { type: 'item', id: 'item-1' }, item: { id: 'item-1', key: 'MINI-1' } }),
      }),
      select: { id: true },
    });
  });

  it('enqueues an n8n-compatible webhook test envelope', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' }); prismaMock.webhook.findFirst.mockResolvedValueOnce({ id: 'webhook-1' }); prismaMock.webhookDelivery.create.mockImplementationOnce(async ({ data }: any) => ({ id: 'delivery-test', status: 'PENDING', payload: data.payload }));
    const res = await request(app).post('/api/projects/project-1/webhooks/webhook-1/test').set('Authorization', `Bearer ${makeToken()}`);
    expect(res.status).toBe(202);
    expect(prismaMock.webhookDelivery.create).toHaveBeenCalledWith({ data: expect.objectContaining({ event_type: 'webhook.test', payload: expect.objectContaining({ event: 'webhook.test', version: 1, actor: { id: 'user-1' }, project: { id: 'project-1' }, entity: { type: 'webhook', id: 'webhook-1' }, item: null }) }), select: { id: true, status: true } });
  });

  it('retries failed webhook delivery with bounded backoff', async () => {
    const { processWebhookDelivery } = await import('../src/services/webhooks'); const { encryptWebhookSecret } = await import('../src/infrastructure/webhookSecurity');
    prismaMock.webhookDelivery.findUnique.mockResolvedValueOnce({ id: 'delivery-1', event_type: 'ITEM_CREATED', payload: { version: 1 }, attempt_count: 0, webhook: { is_active: true, url: 'https://93.184.216.34/hook', secret_encrypted: encryptWebhookSecret('secret') } });
    prismaMock.webhookDelivery.updateMany.mockResolvedValueOnce({ count: 1 }); prismaMock.webhookDelivery.update.mockResolvedValueOnce({});
    await processWebhookDelivery('delivery-1', vi.fn().mockResolvedValue(new Response('temporary failure', { status: 503 })) as typeof fetch);
    expect(prismaMock.webhookDelivery.update).toHaveBeenCalledWith({ where: { id: 'delivery-1' }, data: expect.objectContaining({ status: 'RETRYING', response_status: 503, nextAttemptAt: expect.any(Date) }) });
  });

  it('registers a GitHub repository in an authorized project', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' }); prismaMock.projectRepository.create.mockResolvedValueOnce({ id: 'repo-1', project_id: 'project-1', owner: 'openai', repository: 'miniagil', default_branch: 'main' });
    const res = await request(app).post('/api/projects/project-1/repositories').set('Authorization', `Bearer ${makeToken()}`).send({ owner: 'openai', repository: 'miniagil', default_branch: 'main' });
    expect(res.status).toBe(201); expect(res.body).toEqual(expect.objectContaining({ owner: 'openai', repository: 'miniagil' }));
  });

  it('prevents linking an item to a repository from another project', async () => {
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' }); prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' }); prismaMock.projectRepository.findFirst.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/items/item-1/code-links').set('Authorization', `Bearer ${makeToken()}`).send({ repository_id: 'repo-other', type: 'ISSUE', external_number: 12, url: 'https://github.com/openai/miniagil/issues/12' });
    expect(res.status).toBe(400); expect(res.body.error).toContain('does not belong'); expect(prismaMock.itemCodeLink.create).not.toHaveBeenCalled();
  });

  it('creates, lists and removes an authorized item code link', async () => {
    const repository = { id: 'repo-1', project_id: 'project-1', owner: 'openai', repository: 'miniagil', default_branch: 'main' };
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'item-1', project_id: 'project-1' }); prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' }); prismaMock.projectRepository.findFirst.mockResolvedValueOnce(repository); prismaMock.itemCodeLink.findFirst.mockResolvedValueOnce(null); prismaMock.itemCodeLink.create.mockResolvedValueOnce({ id: 'link-1', item_id: 'item-1', link_type: 'PULL_REQUEST', external_number: 7, url: 'https://github.com/openai/miniagil/pull/7', repository });
    const created = await request(app).post('/api/items/item-1/code-links').set('Authorization', `Bearer ${makeToken()}`).send({ repository_id: 'repo-1', type: 'PULL_REQUEST', external_number: 7, url: 'https://github.com/openai/miniagil/pull/7' });
    expect(created.status).toBe(201); expect(created.body.external_number).toBe(7);
    prismaMock.itemCodeLink.findFirst.mockResolvedValueOnce({ item: { project_id: 'project-1' } }); prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' }); prismaMock.itemCodeLink.findFirst.mockResolvedValueOnce({ id: 'link-1' });
    const removed = await request(app).delete('/api/code-links/link-1').set('Authorization', `Bearer ${makeToken()}`);
    expect(removed.status).toBe(204); expect(prismaMock.itemCodeLink.delete).toHaveBeenCalledWith({ where: { id: 'link-1' } });
  });

  it('creates a team with users and projects as admin', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'ADMIN' });
    prismaMock.user.count.mockResolvedValueOnce(1);
    prismaMock.project.count.mockResolvedValueOnce(1);
    prismaMock.team.create.mockResolvedValueOnce({
      id: 'team-1',
      name: 'Produto',
      members: [{ user: { id: 'user-2', name: 'Ana' } }],
      projects: [{ project: { id: 'project-1', name: 'MiniAgil', key_prefix: 'MINI' } }],
    });

    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        name: 'Produto',
        user_ids: ['user-2'],
        project_ids: ['project-1'],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Produto');
    expect(prismaMock.team.create).toHaveBeenCalled();
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

  it('adds and removes a story through sprint planning while recording history', async () => {
    prismaMock.sprint.findUnique.mockReset()
      .mockResolvedValueOnce({ project_id: 'project-1' })
      .mockResolvedValueOnce({ id: 'sprint-1', name: 'Sprint 1', project_id: 'project-1', status: 'PLANNED' });
    prismaMock.item.findUnique.mockReset().mockResolvedValueOnce({ id: 'story-1', type: 'STORY', project_id: 'project-1', sprint: null });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.item.update.mockResolvedValueOnce({ id: 'story-1', sprint_id: 'sprint-1', sprint: { id: 'sprint-1', name: 'Sprint 1' } });

    const addResponse = await request(app).post('/api/sprints/sprint-1/items/story-1').set('Authorization', `Bearer ${makeToken()}`);

    expect(addResponse.status).toBe(200);
    expect(prismaMock.item.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'story-1' }, data: { sprint_id: 'sprint-1' } }));
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ event_type: 'SPRINT_CHANGED', old_value: { id: null, name: null }, new_value: { id: 'sprint-1', name: 'Sprint 1' } }) });

    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((operation: any) => operation(prismaMock));
    prismaMock.itemHistory.create.mockResolvedValue({ id: 'history-2' });
    prismaMock.notification.createMany.mockResolvedValue({ count: 0 });
    prismaMock.sprint.findUnique.mockReset()
      .mockResolvedValueOnce({ project_id: 'project-1' })
      .mockResolvedValueOnce({ id: 'sprint-1', name: 'Sprint 1', project_id: 'project-1', status: 'PLANNED' });
    prismaMock.item.findUnique.mockReset().mockResolvedValueOnce({ id: 'story-1', type: 'STORY', project_id: 'project-1', sprint: { id: 'sprint-1', name: 'Sprint 1' } });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.item.update.mockResolvedValueOnce({ id: 'story-1', sprint_id: null, sprint: null });

    const removeResponse = await request(app).delete('/api/sprints/sprint-1/items/story-1').set('Authorization', `Bearer ${makeToken()}`);
    expect(removeResponse.status).toBe(200);
    expect(prismaMock.item.update).toHaveBeenCalledWith(expect.objectContaining({ data: { sprint_id: null } }));
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ event_type: 'SPRINT_CHANGED', old_value: { id: 'sprint-1', name: 'Sprint 1' }, new_value: { id: null, name: null } }) });
  });

  it('rejects planning an epic or a story from another project', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.sprint.findUnique.mockResolvedValue({ id: 'sprint-1', name: 'Sprint 1', project_id: 'project-1', status: 'PLANNED' });
    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'epic-1', type: 'EPIC', project_id: 'project-1', sprint: null });
    const epicResponse = await request(app).post('/api/sprints/sprint-1/items/epic-1').set('Authorization', `Bearer ${makeToken()}`);
    expect(epicResponse.status).toBe(400);
    expect(epicResponse.body.error).toContain('Only STORY');

    prismaMock.item.findUnique.mockResolvedValueOnce({ id: 'story-2', type: 'STORY', project_id: 'project-2', sprint: null });
    const projectResponse = await request(app).post('/api/sprints/sprint-1/items/story-2').set('Authorization', `Bearer ${makeToken()}`);
    expect(projectResponse.status).toBe(400);
    expect(projectResponse.body.error).toContain('same project');
    expect(prismaMock.item.update).not.toHaveBeenCalled();
  });

  it('allows project members to list workflows but blocks workflow mutations', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'USER' });
    prismaMock.projectMember.findFirst.mockResolvedValue({ role: 'MEMBER' });
    prismaMock.workflow.findMany.mockResolvedValue([{ id: 'workflow-1', item_type: 'TASK', statuses: [] }]);

    const listRes = await request(app)
      .get('/api/projects/project-1/workflows')
      .set('Authorization', `Bearer ${makeToken('USER')}`);
    const createRes = await request(app)
      .post('/api/projects/project-1/workflows')
      .set('Authorization', `Bearer ${makeToken('USER')}`)
      .send({ name: 'Restricted', item_type: 'TASK' });

    expect(listRes.status).toBe(200);
    expect(createRes.status).toBe(403);
    expect(prismaMock.workflow.create).not.toHaveBeenCalled();
  });

  it('keeps exactly one active initial status when another status becomes initial', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.workflow.findFirst.mockResolvedValue({
      id: 'workflow-1', project_id: 'project-1', statuses: [
        { id: 'status-1', is_active: true, is_initial: true, is_final: false },
        { id: 'status-2', is_active: true, is_initial: false, is_final: true },
      ],
    });
    prismaMock.workflowStatus.update.mockResolvedValue({ id: 'status-2', is_initial: true });

    const res = await request(app)
      .patch('/api/projects/project-1/workflows/workflow-1/statuses/status-2')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ is_initial: true });

    expect(res.status).toBe(200);
    expect(prismaMock.workflowStatus.updateMany).toHaveBeenCalledWith({
      where: { workflow_id: 'workflow-1', id: { not: 'status-2' } },
      data: { is_initial: false },
    });
  });

  it('moves items to a controlled replacement before deactivating a status', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.workflow.findFirst.mockResolvedValue({
      id: 'workflow-1', project_id: 'project-1', statuses: [
        { id: 'status-1', is_active: true, is_initial: false, is_final: false },
        { id: 'status-2', is_active: true, is_initial: true, is_final: true },
      ],
    });
    prismaMock.item.count.mockResolvedValue(2);
    prismaMock.item.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.workflowStatus.update.mockResolvedValue({ id: 'status-1', is_active: false });

    const res = await request(app)
      .patch('/api/projects/project-1/workflows/workflow-1/statuses/status-1')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ is_active: false, replacement_status_id: 'status-2' });

    expect(res.status).toBe(200);
    expect(prismaMock.item.updateMany).toHaveBeenCalledWith({
      where: { workflow_status_id: 'status-1' },
      data: { workflow_status_id: 'status-2' },
    });
  });

  it('refuses destructive deletion of a status used by items', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.workflow.findFirst.mockResolvedValue({
      id: 'workflow-1', project_id: 'project-1', statuses: [
        { id: 'status-1', is_active: true, is_initial: false, is_final: false },
        { id: 'status-2', is_active: true, is_initial: true, is_final: true },
      ],
    });
    prismaMock.item.count.mockResolvedValue(1);

    const res = await request(app)
      .delete('/api/projects/project-1/workflows/workflow-1/statuses/status-1')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(409);
    expect(prismaMock.workflowStatus.delete).not.toHaveBeenCalled();
  });

  it('persists the complete workflow status ordering', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.workflow.findFirst
      .mockResolvedValueOnce({
        id: 'workflow-1', project_id: 'project-1', statuses: [
          { id: 'status-1', is_active: true },
          { id: 'status-2', is_active: true },
        ],
      })
      .mockResolvedValueOnce({ id: 'workflow-1', project_id: 'project-1', statuses: [] });
    prismaMock.workflowStatus.update.mockResolvedValue({});

    const res = await request(app)
      .patch('/api/projects/project-1/workflows/workflow-1/statuses/reorder')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ status_ids: ['status-2', 'status-1'] });

    expect(res.status).toBe(200);
    expect(prismaMock.workflowStatus.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'status-2' }, data: { position: 0, order: 0 },
    });
    expect(prismaMock.workflowStatus.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'status-1' }, data: { position: 1, order: 1 },
    });
  });

  it('persists a card position between neighboring cards without updating the whole item', async () => {
    const updatedAt = new Date('2026-08-03T12:00:00.000Z');
    const snapshot = {
      id: 'item-1', type: 'TASK', project_id: 'project-1', title: 'Mover', description: null,
      priority: 'MEDIUM', estimate: null, acceptance_criteria: null, board_position: 0, updatedAt,
      workflow_status: { id: 'status-1', name: 'A fazer', workflow_id: 'workflow-1' }, assignee: null, sprint: null,
    };
    prismaMock.item.findUnique
      .mockResolvedValueOnce({ project_id: 'project-1' })
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce({ updatedAt });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.workflowStatus.findUnique.mockResolvedValueOnce({
      id: 'status-1', name: 'A fazer', workflow_id: 'workflow-1', is_active: true, wip_limit: null,
      workflow: { project_id: 'project-1', item_type: 'TASK' },
    });
    prismaMock.item.findMany.mockResolvedValueOnce([
      { id: 'item-2', board_position: 1024 }, { id: 'item-3', board_position: 2048 },
    ]);
    prismaMock.item.update.mockResolvedValueOnce({ ...snapshot, board_position: 1536, parent: null, children: [] });
    prismaMock.item.count.mockResolvedValueOnce(3);

    const res = await request(app)
      .patch('/api/items/item-1/board-position')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ workflow_status_id: 'status-1', target_index: 1, expected_updated_at: updatedAt.toISOString() });

    expect(res.status).toBe(200);
    expect(prismaMock.item.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'item-1' }, data: { board_position: 1536 },
    }));
    expect(res.body.column).toEqual({ status_id: 'status-1', count: 3, wip_limit: null, exceeded: false });
  });

  it('persists backlog ordering between neighboring items', async () => {
    const updatedAt = new Date('2026-08-03T12:00:00.000Z');
    prismaMock.item.findUnique
      .mockResolvedValueOnce({ project_id: 'project-1' })
      .mockResolvedValueOnce({ id: 'story-1', project_id: 'project-1', sprint_id: null })
      .mockResolvedValueOnce({ updatedAt });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.item.findMany.mockResolvedValue([
      { id: 'story-2', backlog_position: 1024 }, { id: 'story-3', backlog_position: 2048 },
    ]);
    prismaMock.item.update.mockResolvedValue({ id: 'story-1', backlog_position: 1536 });

    const res = await request(app).patch('/api/items/story-1/backlog-position')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ target_index: 1, expected_updated_at: updatedAt.toISOString() });

    expect(res.status).toBe(200);
    expect(prismaMock.item.update).toHaveBeenCalledWith({ where: { id: 'story-1' }, data: { backlog_position: 1536 } });
    expect(prismaMock.item.update).toHaveBeenCalledTimes(1);
  });

  it('moves a card between columns, records status history and warns when WIP is exceeded', async () => {
    const updatedAt = new Date('2026-08-03T12:00:00.000Z');
    const before = {
      id: 'item-1', type: 'TASK', project_id: 'project-1', title: 'Mover', description: null,
      priority: 'MEDIUM', estimate: null, acceptance_criteria: null, board_position: 1024, updatedAt,
      workflow_status: { id: 'status-1', name: 'A fazer', workflow_id: 'workflow-1' }, assignee: null, sprint: null,
    };
    const after = { ...before, board_position: 2048, workflow_status: { id: 'status-2', name: 'Em andamento', workflow_id: 'workflow-1' }, parent: null, children: [] };
    prismaMock.item.findUnique
      .mockResolvedValueOnce({ project_id: 'project-1' })
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce({ updatedAt });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.workflowStatus.findUnique.mockResolvedValueOnce({
      id: 'status-2', name: 'Em andamento', workflow_id: 'workflow-1', is_active: true, wip_limit: 1,
      workflow: { project_id: 'project-1', item_type: 'TASK' },
    });
    prismaMock.item.findMany.mockResolvedValueOnce([{ id: 'item-2', board_position: 1024 }]);
    prismaMock.item.update.mockResolvedValueOnce(after);
    prismaMock.item.count.mockResolvedValueOnce(2);

    const res = await request(app)
      .patch('/api/items/item-1/board-position')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ workflow_status_id: 'status-2', target_index: 1, expected_updated_at: updatedAt.toISOString() });

    expect(res.status).toBe(200);
    expect(res.body.warnings[0].code).toBe('WIP_LIMIT_EXCEEDED');
    expect(res.body.column).toEqual({ status_id: 'status-2', count: 2, wip_limit: 1, exceeded: true });
    expect(prismaMock.itemHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ event_type: 'STATUS_CHANGED' }) });
  });

  it('rejects moving a card to a status from another workflow', async () => {
    prismaMock.item.findUnique
      .mockResolvedValueOnce({ project_id: 'project-1' })
      .mockResolvedValueOnce({
        id: 'item-1', type: 'TASK', project_id: 'project-1', title: 'Mover', description: null,
        priority: 'MEDIUM', estimate: null, acceptance_criteria: null, board_position: 0, updatedAt: new Date(),
        workflow_status: { id: 'status-1', name: 'A fazer', workflow_id: 'workflow-1' }, assignee: null, sprint: null,
      });
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.workflowStatus.findUnique.mockResolvedValueOnce({
      id: 'foreign-status', workflow_id: 'workflow-2', is_active: true, wip_limit: null,
      workflow: { project_id: 'project-1', item_type: 'TASK' },
    });

    const res = await request(app)
      .patch('/api/items/item-1/board-position')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ workflow_status_id: 'foreign-status', target_index: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('item workflow');
    expect(prismaMock.item.update).not.toHaveBeenCalled();
  });

  it('applies validated advanced filters to the Kanban query', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'project-1', name: 'Projeto', key_prefix: 'PRJ' });
    prismaMock.sprint.findFirst.mockResolvedValueOnce({ id: 'sprint-1', project_id: 'project-1', status: 'ACTIVE' });
    prismaMock.item.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/items/backlog-overview?project_id=project-1&type=TASK&priority=HIGH&assignee_id=user-2&text=urgente')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(res.status).toBe(200);
    expect(prismaMock.item.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        project_id: 'project-1',
        AND: expect.arrayContaining([expect.objectContaining({
          type: { in: ['TASK'] }, priority: { in: ['HIGH'] }, assignee_id: 'user-2',
          OR: expect.arrayContaining([expect.objectContaining({ title: { contains: 'urgente' } })]),
        })]),
      }),
    }));
  });

  it('saves and lists only the current user Kanban views', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prismaMock.savedView.create.mockResolvedValueOnce({
      id: 'view-1', user_id: 'user-1', project_id: 'project-1', name: 'Meus bugs', view_type: 'KANBAN',
      filters: { types: ['BUG'] }, is_default: false,
    });
    prismaMock.savedView.findMany.mockResolvedValueOnce([{ id: 'view-1', name: 'Meus bugs', filters: { types: ['BUG'] } }]);

    const createRes = await request(app)
      .post('/api/projects/project-1/saved-views')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'Meus bugs', filters: { types: ['BUG'] } });
    const listRes = await request(app)
      .get('/api/projects/project-1/saved-views')
      .set('Authorization', `Bearer ${makeToken()}`);

    expect(createRes.status).toBe(201);
    expect(listRes.status).toBe(200);
    expect(prismaMock.savedView.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ user_id: 'user-1', project_id: 'project-1', filters: { types: ['BUG'] } }),
    });
    expect(prismaMock.savedView.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 'user-1', project_id: 'project-1', view_type: 'KANBAN' },
    }));
  });

  it('does not allow a user to alter another user saved view', async () => {
    prismaMock.savedView.findFirst.mockResolvedValueOnce(null);

    const res = await request(app)
      .patch('/api/saved-views/view-from-another-user')
      .set('Authorization', `Bearer ${makeToken('USER')}`)
      .send({ name: 'Tentativa' });

    expect(res.status).toBe(404);
    expect(prismaMock.savedView.update).not.toHaveBeenCalled();
  });

  it('rejects executable or unsupported saved view filters', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

    const res = await request(app)
      .post('/api/projects/project-1/saved-views')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'Inválida', filters: { sql: 'DROP TABLE items' } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Unsupported filter field');
    expect(prismaMock.savedView.create).not.toHaveBeenCalled();
  });
});

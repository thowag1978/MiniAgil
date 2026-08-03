import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma, WebhookDeliveryStatus } from '@prisma/client';
import { prisma } from '../infrastructure/db';
import { DOMAIN_EVENT_TYPES, DomainEvent, domainEventBus } from '../infrastructure/domainEvents';
import { decryptWebhookSecret, encryptWebhookSecret, validateWebhookUrl, webhookSignature } from '../infrastructure/webhookSecurity';

export class WebhookError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
const responseLimit = () => Number(process.env.WEBHOOK_RESPONSE_MAX_BYTES || 4096);
const maxAttempts = () => Number(process.env.WEBHOOK_MAX_ATTEMPTS || 4);
const timeoutMs = () => Number(process.env.WEBHOOK_TIMEOUT_MS || 5000);
const processingTimeoutMs = () => Number(process.env.WEBHOOK_PROCESSING_TIMEOUT_MS || 60_000);
const publicWebhook = { id: true, project_id: true, name: true, url: true, events: true, is_active: true, createdAt: true, updatedAt: true } as const;
const externalEventNames: Record<string, string> = {
  ITEM_CREATED: 'item.created', ITEM_UPDATED: 'item.updated', ITEM_STATUS_CHANGED: 'item.status_changed', ITEM_ASSIGNED: 'item.assigned',
  COMMENT_CREATED: 'comment.created', ATTACHMENT_CREATED: 'attachment.created', BUG_CREATED: 'bug.created', BUG_REOPENED: 'bug.reopened',
  SPRINT_STARTED: 'sprint.started', SPRINT_FINISHED: 'sprint.finished', WEBHOOK_TEST: 'webhook.test',
};

export function toWebhookPayload(event: DomainEvent) {
  const itemId = ['ITEM', 'BUG'].includes(event.entity.type) ? event.entity.id : typeof event.payload.itemId === 'string' ? event.payload.itemId : null;
  return {
    eventId: event.eventId, event: externalEventNames[event.eventType] ?? event.eventType.toLowerCase(), version: event.version, occurredAt: event.occurredAt,
    actor: { id: event.actor.id }, project: { id: event.project.id },
    entity: { type: event.entity.type.toLowerCase(), id: event.entity.id },
    item: itemId ? { id: itemId, ...(typeof event.payload.projectKey === 'string' ? { key: event.payload.projectKey } : {}) } : null,
    data: event.payload,
  };
}

function parseEvents(value: unknown) { if (!Array.isArray(value) || !value.length || value.some((event) => typeof event !== 'string' || !DOMAIN_EVENT_TYPES.includes(event as any))) throw new WebhookError(400, 'At least one valid event is required'); return [...new Set(value as string[])]; }
export async function createWebhook(input: { projectId: string; name: unknown; url: unknown; events: unknown; active?: unknown }) { const name = String(input.name || '').trim(); if (!name) throw new WebhookError(400, 'Webhook name is required'); let url: string; try { url = await validateWebhookUrl(String(input.url || '')); } catch (error) { throw new WebhookError(400, error instanceof Error ? error.message : 'Invalid webhook URL'); } const events = parseEvents(input.events); const secret = randomBytes(32).toString('base64url'); const webhook = await prisma.webhook.create({ data: { project_id: input.projectId, name, url, events, secret_encrypted: encryptWebhookSecret(secret), is_active: input.active === undefined ? true : Boolean(input.active) }, select: publicWebhook }); return { ...webhook, secret }; }
export const listWebhooks = (projectId: string) => prisma.webhook.findMany({ where: { project_id: projectId }, select: { ...publicWebhook, _count: { select: { deliveries: true } } }, orderBy: { createdAt: 'desc' } });
export async function updateWebhook(projectId: string, id: string, body: any) { const current = await prisma.webhook.findFirst({ where: { id, project_id: projectId } }); if (!current) throw new WebhookError(404, 'Webhook not found'); const data: Prisma.WebhookUpdateInput = {}; if (body.name !== undefined) { data.name = String(body.name).trim(); if (!data.name) throw new WebhookError(400, 'Webhook name is required'); } if (body.url !== undefined) { try { data.url = await validateWebhookUrl(String(body.url)); } catch (error) { throw new WebhookError(400, error instanceof Error ? error.message : 'Invalid webhook URL'); } } if (body.events !== undefined) data.events = parseEvents(body.events); if (body.is_active !== undefined) data.is_active = Boolean(body.is_active); return prisma.webhook.update({ where: { id }, data, select: publicWebhook }); }
export const listDeliveries = (projectId: string, webhookId?: string) => prisma.webhookDelivery.findMany({ where: { webhook: { project_id: projectId }, ...(webhookId ? { webhook_id: webhookId } : {}) }, select: { id: true, webhook_id: true, event_id: true, event_type: true, status: true, attempt_count: true, response_status: true, response_body: true, last_error: true, nextAttemptAt: true, deliveredAt: true, createdAt: true, webhook: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
export async function enqueueDomainEvent(event: DomainEvent) { const webhooks = await prisma.webhook.findMany({ where: { project_id: event.project.id, is_active: true } }); const payload = toWebhookPayload(event); for (const webhook of webhooks) { const events = webhook.events as string[]; if (!events.includes(event.eventType)) continue; await prisma.webhookDelivery.create({ data: { webhook_id: webhook.id, event_id: event.eventId, event_type: payload.event, payload: payload as unknown as Prisma.InputJsonValue }, select: { id: true } }).catch((error) => { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error; }); } }
export function registerWebhookEventHandler() { return domainEventBus.subscribe('*', enqueueDomainEvent); }
export async function enqueueTestDelivery(projectId: string, webhookId: string, actorId: string) { const webhook = await prisma.webhook.findFirst({ where: { id: webhookId, project_id: projectId }, select: { id: true } }); if (!webhook) throw new WebhookError(404, 'Webhook not found'); const eventId = randomUUID(); const payload = { eventId, event: 'webhook.test', version: 1, occurredAt: new Date().toISOString(), actor: { id: actorId }, project: { id: projectId }, entity: { type: 'webhook', id: webhookId }, item: null, data: { test: true } }; return prisma.webhookDelivery.create({ data: { webhook_id: webhook.id, event_id: eventId, event_type: payload.event, payload }, select: { id: true, status: true } }); }
export async function retryDelivery(projectId: string, id: string) { const delivery = await prisma.webhookDelivery.findFirst({ where: { id, webhook: { project_id: projectId } } }); if (!delivery) throw new WebhookError(404, 'Delivery not found'); return prisma.webhookDelivery.update({ where: { id }, data: { status: 'PENDING', attempt_count: 0, nextAttemptAt: new Date(), processingStartedAt: null, last_error: null }, select: { id: true, status: true } }); }

export function recoverStaleWebhookDeliveries(now = new Date()) {
  return prisma.webhookDelivery.updateMany({
    where: {
      status: WebhookDeliveryStatus.PROCESSING,
      processingStartedAt: { lte: new Date(now.getTime() - processingTimeoutMs()) },
    },
    data: {
      status: WebhookDeliveryStatus.RETRYING,
      processingStartedAt: null,
      nextAttemptAt: now,
      last_error: 'Recovered after an interrupted worker execution',
    },
  });
}

export async function processWebhookDelivery(id: string, fetcher: typeof fetch = fetch) {
  const delivery = await prisma.webhookDelivery.findUnique({ where: { id }, include: { webhook: true } }); if (!delivery || !delivery.webhook.is_active) return;
  const claimed = await prisma.webhookDelivery.updateMany({ where: { id, status: { in: ['PENDING','RETRYING'] } }, data: { status: 'PROCESSING', processingStartedAt: new Date(), attempt_count: { increment: 1 } } }); if (!claimed.count) return;
  const attempt = delivery.attempt_count + 1;
  try { await validateWebhookUrl(delivery.webhook.url); const body = JSON.stringify(delivery.payload); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs()); let response: Response; try { response = await fetcher(delivery.webhook.url, { method: 'POST', redirect: 'error', signal: controller.signal, headers: { 'content-type': 'application/json', 'user-agent': 'MiniAgil-Webhooks/1.0', 'x-miniagil-event': delivery.event_type, 'x-miniagil-delivery': delivery.id, 'x-miniagil-signature': webhookSignature(body, decryptWebhookSecret(delivery.webhook.secret_encrypted)) }, body }); } finally { clearTimeout(timer); } const responseBody = (await response.text()).slice(0, responseLimit()); if (!response.ok) throw Object.assign(new Error(`Webhook returned HTTP ${response.status}`), { responseStatus: response.status, responseBody }); await prisma.webhookDelivery.update({ where: { id }, data: { status: 'SUCCEEDED', processingStartedAt: null, response_status: response.status, response_body: responseBody, last_error: null, deliveredAt: new Date(), nextAttemptAt: null } }); }
  catch (error) { const exhausted = attempt >= maxAttempts(); const delay = Math.min(60 * 2 ** (attempt - 1), 3600); await prisma.webhookDelivery.update({ where: { id }, data: { status: exhausted ? 'FAILED' : 'RETRYING', processingStartedAt: null, response_status: (error as any).responseStatus ?? null, response_body: String((error as any).responseBody ?? '').slice(0, responseLimit()) || null, last_error: String(error instanceof Error ? error.message : error).slice(0, responseLimit()), nextAttemptAt: exhausted ? null : new Date(Date.now() + delay * 1000) } }); }
}

let worker: ReturnType<typeof setInterval> | null = null;
export function startWebhookWorker() { if (worker) return; worker = setInterval(async () => { try { const now = new Date(); await recoverStaleWebhookDeliveries(now); const due = await prisma.webhookDelivery.findMany({ where: { status: { in: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.RETRYING] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: 20 }); await Promise.all(due.map(({ id }) => processWebhookDelivery(id))); } catch (error) { console.error('Webhook worker failed', error); } }, Number(process.env.WEBHOOK_WORKER_INTERVAL_MS || 5000)); worker.unref(); }

import { DomainEventOutboxStatus, Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/db';
import { createDomainEvent, DomainEvent, domainEventBus } from '../infrastructure/domainEvents';

const maxAttempts = () => Number(process.env.DOMAIN_EVENT_MAX_ATTEMPTS || 8);
const processingTimeoutMs = () => Number(process.env.DOMAIN_EVENT_PROCESSING_TIMEOUT_MS || 60_000);

export async function publishDomainEvent<T extends Record<string, unknown>>(
  input: Parameters<typeof createDomainEvent<T>>[0],
) {
  const event = createDomainEvent(input);
  await prisma.domainEventOutbox.create({
    data: {
      event_id: event.eventId,
      event_type: event.eventType,
      payload: event as unknown as Prisma.InputJsonValue,
    },
  });
  return { eventId: event.eventId, duplicate: false, failures: [] };
}

export async function recoverStaleDomainEvents(now = new Date()) {
  const staleBefore = new Date(now.getTime() - processingTimeoutMs());
  return prisma.domainEventOutbox.updateMany({
    where: {
      status: DomainEventOutboxStatus.PROCESSING,
      processingStartedAt: { lte: staleBefore },
    },
    data: {
      status: DomainEventOutboxStatus.RETRYING,
      processingStartedAt: null,
      nextAttemptAt: now,
      last_error: 'Recovered after an interrupted worker execution',
    },
  });
}

export async function processDomainEvent(id: string) {
  const claimed = await prisma.domainEventOutbox.updateMany({
    where: {
      id,
      status: { in: [DomainEventOutboxStatus.PENDING, DomainEventOutboxStatus.RETRYING] },
    },
    data: {
      status: DomainEventOutboxStatus.PROCESSING,
      processingStartedAt: new Date(),
      attempt_count: { increment: 1 },
    },
  });
  if (!claimed.count) return;

  const record = await prisma.domainEventOutbox.findUnique({ where: { id } });
  if (!record) return;

  try {
    const result = await domainEventBus.publish(record.payload as unknown as DomainEvent);
    if (result.failures.length) throw new Error(`${result.failures.length} domain event handler(s) failed`);
    await prisma.domainEventOutbox.update({
      where: { id },
      data: {
        status: DomainEventOutboxStatus.PUBLISHED,
        processingStartedAt: null,
        nextAttemptAt: null,
        publishedAt: new Date(),
        last_error: null,
      },
    });
  } catch (error) {
    const exhausted = record.attempt_count >= maxAttempts();
    const delaySeconds = Math.min(2 ** Math.max(record.attempt_count - 1, 0), 300);
    await prisma.domainEventOutbox.update({
      where: { id },
      data: {
        status: exhausted ? DomainEventOutboxStatus.FAILED : DomainEventOutboxStatus.RETRYING,
        processingStartedAt: null,
        nextAttemptAt: exhausted ? null : new Date(Date.now() + delaySeconds * 1000),
        last_error: String(error instanceof Error ? error.message : error).slice(0, 4096),
      },
    });
  }
}

let worker: ReturnType<typeof setInterval> | null = null;
export function startDomainEventOutboxWorker() {
  if (worker) return;
  worker = setInterval(async () => {
    try {
      const now = new Date();
      await recoverStaleDomainEvents(now);
      const due = await prisma.domainEventOutbox.findMany({
        where: {
          status: { in: [DomainEventOutboxStatus.PENDING, DomainEventOutboxStatus.RETRYING] },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      await Promise.all(due.map(({ id }) => processDomainEvent(id)));
    } catch (error) {
      console.error('Domain event outbox worker failed', error);
    }
  }, Number(process.env.DOMAIN_EVENT_WORKER_INTERVAL_MS || 1000));
  worker.unref();
}

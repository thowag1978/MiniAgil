import { randomUUID } from 'node:crypto';

export const DOMAIN_EVENT_TYPES = ['ITEM_CREATED','ITEM_UPDATED','ITEM_STATUS_CHANGED','ITEM_ASSIGNED','COMMENT_CREATED','ATTACHMENT_CREATED','BUG_CREATED','BUG_REOPENED','SPRINT_STARTED','SPRINT_FINISHED'] as const;
export type DomainEventType = typeof DOMAIN_EVENT_TYPES[number];
export type DomainEntityType = 'ITEM' | 'COMMENT' | 'ATTACHMENT' | 'BUG' | 'SPRINT';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: DomainEventType;
  version: 1;
  occurredAt: string;
  actor: { id: string };
  project: { id: string };
  entity: { type: DomainEntityType; id: string };
  payload: TPayload;
}
export type DomainEventHandler = (event: DomainEvent) => void | Promise<void>;
export interface PublishResult { eventId: string; duplicate: boolean; failures: Array<{ handler: string; error: unknown }> }

export function createDomainEvent<T extends Record<string, unknown>>(input: Omit<DomainEvent<T>, 'eventId' | 'version' | 'occurredAt'> & { eventId?: string; occurredAt?: string }): DomainEvent<T> {
  return { eventId: input.eventId ?? randomUUID(), eventType: input.eventType, version: 1, occurredAt: input.occurredAt ?? new Date().toISOString(), actor: input.actor, project: input.project, entity: input.entity, payload: input.payload };
}

export class DomainEventBus {
  private handlers = new Map<DomainEventType | '*', Set<DomainEventHandler>>();
  private processed = new Set<string>();
  constructor(private readonly deduplicationLimit = 10_000) {}
  subscribe(type: DomainEventType | '*', handler: DomainEventHandler) { const handlers = this.handlers.get(type) ?? new Set(); handlers.add(handler); this.handlers.set(type, handlers); return () => handlers.delete(handler); }
  async publish(event: DomainEvent): Promise<PublishResult> {
    if (this.processed.has(event.eventId)) return { eventId: event.eventId, duplicate: true, failures: [] };
    this.processed.add(event.eventId);
    if (this.processed.size > this.deduplicationLimit) this.processed.delete(this.processed.values().next().value!);
    const handlers = [...(this.handlers.get(event.eventType) ?? []), ...(this.handlers.get('*') ?? [])];
    const failures: PublishResult['failures'] = [];
    for (const handler of handlers) { try { await handler(event); } catch (error) { failures.push({ handler: handler.name || 'anonymous', error }); console.error(`Domain event handler failed for ${event.eventType}`, error); } }
    return { eventId: event.eventId, duplicate: false, failures };
  }
  clear() { this.handlers.clear(); this.processed.clear(); }
}

export const domainEventBus = new DomainEventBus();
export async function publishDomainEvent<T extends Record<string, unknown>>(input: Parameters<typeof createDomainEvent<T>>[0]) { return domainEventBus.publish(createDomainEvent(input)); }

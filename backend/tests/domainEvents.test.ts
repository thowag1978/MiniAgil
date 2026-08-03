import { describe, expect, it, vi } from 'vitest';
import { createDomainEvent, DomainEventBus } from '../src/infrastructure/domainEvents';

const input = { eventType: 'ITEM_CREATED' as const, actor: { id: 'user-1' }, project: { id: 'project-1' }, entity: { type: 'ITEM' as const, id: 'item-1' }, payload: { title: 'Item' } };

describe('domain events', () => {
  it('creates the versioned standard envelope', () => {
    const event = createDomainEvent(input);
    expect(event).toEqual(expect.objectContaining({ eventId: expect.any(String), eventType: 'ITEM_CREATED', version: 1, occurredAt: expect.any(String), actor: { id: 'user-1' }, project: { id: 'project-1' }, entity: { type: 'ITEM', id: 'item-1' }, payload: { title: 'Item' } }));
  });

  it('awaits synchronous handlers and deduplicates the event id', async () => {
    const bus = new DomainEventBus(); const handler = vi.fn(); bus.subscribe('ITEM_CREATED', handler);
    const event = createDomainEvent({ ...input, eventId: 'event-fixed' });
    expect((await bus.publish(event)).duplicate).toBe(false);
    expect((await bus.publish(event)).duplicate).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('isolates a secondary handler failure from the publisher', async () => {
    const bus = new DomainEventBus(); const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const successful = vi.fn(); bus.subscribe('ITEM_CREATED', async () => { throw new Error('secondary failure'); }); bus.subscribe('ITEM_CREATED', successful);
    const result = await bus.publish(createDomainEvent(input));
    expect(result.failures).toHaveLength(1); expect(successful).toHaveBeenCalledTimes(1); log.mockRestore();
  });
});

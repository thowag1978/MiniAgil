# Eventos de domínio

O `DomainEventBus` é um dispatcher interno e não depende de Express, Prisma ou dos módulos de negócio. Serviços publicam somente depois da confirmação da operação principal. Handlers são aguardados sequencialmente nesta versão, mas suas falhas são coletadas e registradas sem lançar erro para o serviço chamador.

Envelope versão 1:

```json
{"eventId":"uuid","eventType":"ITEM_CREATED","version":1,"occurredAt":"2026-08-03T12:00:00.000Z","actor":{"id":"user-id"},"project":{"id":"project-id"},"entity":{"type":"ITEM","id":"item-id"},"payload":{}}
```

Tipos iniciais: `ITEM_CREATED`, `ITEM_UPDATED`, `ITEM_STATUS_CHANGED`, `ITEM_ASSIGNED`, `COMMENT_CREATED`, `ATTACHMENT_CREATED`, `BUG_CREATED`, `BUG_REOPENED`, `SPRINT_STARTED` e `SPRINT_FINISHED`.

Histórico, notificações e futuros webhooks podem registrar handlers com `domainEventBus.subscribe(tipo, handler)`. O handler deve traduzir o evento para sua própria operação, sem repetir validações ou regras do serviço de origem. `eventId` é deduplicado em memória numa janela limitada. A interface poderá ser substituída por um publicador baseado em outbox/fila sem alterar o envelope; a deduplicação durável deverá usar `eventId`.

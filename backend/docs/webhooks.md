# Webhooks e n8n

Os webhooks do MiniAgil são genéricos e podem ser consumidos pelo n8n ou por qualquer servidor HTTP. Não existe dependência direta do backend com o n8n.

## Envelope versão 1

Todas as entregas usam o mesmo formato:

```json
{
  "eventId": "7ab73aa5-695f-47af-a74d-5ee89a42e676",
  "event": "bug.created",
  "version": 1,
  "occurredAt": "2026-08-03T17:00:00.000Z",
  "actor": { "id": "user-uuid" },
  "project": { "id": "project-uuid" },
  "entity": { "type": "bug", "id": "item-uuid" },
  "item": { "id": "item-uuid", "key": "MINI-42" },
  "data": { "projectKey": "MINI-42" }
}
```

`eventId` identifica a entrega lógica e pode ser usado pelo consumidor para idempotência. `entity` identifica a entidade que originou o evento. `item` identifica diretamente o item relacionado; em eventos de sprint ou teste ele pode ser `null`. Campos novos podem ser acrescentados de forma compatível na versão 1. Alterações incompatíveis exigirão incremento de `version`.

Eventos externos:

| Configuração | Payload `event` |
|---|---|
| `ITEM_CREATED` | `item.created` |
| `ITEM_UPDATED` | `item.updated` |
| `ITEM_STATUS_CHANGED` | `item.status_changed` |
| `ITEM_ASSIGNED` | `item.assigned` |
| `COMMENT_CREATED` | `comment.created` |
| `ATTACHMENT_CREATED` | `attachment.created` |
| `BUG_CREATED` | `bug.created` |
| `BUG_REOPENED` | `bug.reopened` |
| `SPRINT_STARTED` | `sprint.started` |
| `SPRINT_FINISHED` | `sprint.finished` |

### Exemplos

Mudança de status:

```json
{"eventId":"uuid","event":"item.status_changed","version":1,"occurredAt":"2026-08-03T17:00:00.000Z","actor":{"id":"user-1"},"project":{"id":"project-1"},"entity":{"type":"item","id":"item-1"},"item":{"id":"item-1"},"data":{"fromStatusId":"status-1","toStatusId":"status-2"}}
```

Comentário criado:

```json
{"eventId":"uuid","event":"comment.created","version":1,"occurredAt":"2026-08-03T17:00:00.000Z","actor":{"id":"user-1"},"project":{"id":"project-1"},"entity":{"type":"comment","id":"comment-1"},"item":{"id":"item-1"},"data":{"itemId":"item-1"}}
```

Sprint encerrada:

```json
{"eventId":"uuid","event":"sprint.finished","version":1,"occurredAt":"2026-08-03T17:00:00.000Z","actor":{"id":"user-1"},"project":{"id":"project-1"},"entity":{"type":"sprint","id":"sprint-1"},"item":null,"data":{"name":"Sprint 12","movedItems":3}}
```

O botão **Testar** enfileira um payload `webhook.test` com ator, projeto e webhook. O teste usa o mesmo worker, assinatura e política de repetição das entregas reais.

## Configuração no n8n

1. Crie um node **Webhook** com método `POST` e copie a URL de produção.
2. Cadastre essa URL nas configurações do projeto MiniAgil e copie o segredo exibido uma única vez.
3. Configure o Webhook node para preservar o corpo recebido. Guarde o segredo em uma credencial ou variável protegida do n8n; não o grave no workflow nem em logs.
4. Use `eventId` para evitar processamento duplicado e responda rapidamente com HTTP 2xx. Para trabalhos demorados, continue o fluxo depois da resposta.
5. Clique em **Testar** no MiniAgil e confira uma entrega `webhook.test` no n8n.

## Validação HMAC

Headers enviados:

- `X-MiniAgil-Event`: nome externo, por exemplo `bug.created`;
- `X-MiniAgil-Delivery`: ID da tentativa persistida;
- `X-MiniAgil-Signature`: `sha256=<hex>`;
- `Content-Type: application/json`.

A assinatura usa HMAC-SHA256 sobre os bytes exatos do corpo HTTP. Exemplo JavaScript para um Code node ou serviço intermediário:

```js
const crypto = require('crypto');

const rawBody = Buffer.from(rawRequestBody, 'utf8');
const expected = 'sha256=' + crypto
  .createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex');

const received = requestHeaders['x-miniagil-signature'];
const valid = typeof received === 'string'
  && received.length === expected.length
  && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));

if (!valid) throw new Error('Invalid MiniAgil webhook signature');
```

Se o n8n disponibilizar apenas o JSON já interpretado, habilite a opção de corpo bruto do Webhook node. Não valide uma representação reformatada do JSON.

## Respostas e erros

- `200`, `201`, `202` ou `204`: entrega concluída;
- qualquer resposta fora de 2xx: falha temporária e nova tentativa até o limite configurado;
- timeout, falha DNS, redirect ou destino que passe a resolver para rede privada: entrega rejeitada e repetida conforme a política;
- após o limite: status `FAILED`, disponível para reprocessamento manual.

Exemplo de resposta recomendada:

```json
{"received": true, "eventId": "7ab73aa5-695f-47af-a74d-5ee89a42e676"}
```

O MiniAgil armazena somente uma parte limitada da resposta. Segredos nunca fazem parte do payload, dos registros de entrega ou da listagem administrativa.

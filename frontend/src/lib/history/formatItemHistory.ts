import type { ItemHistoryRecord } from '@/lib/types';

const priorityLabels: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

function objectValue(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}

function readableValue(value: unknown, emptyLabel = 'não informado'): string {
  const candidate = objectValue(value, 'name') ?? objectValue(value, 'value') ?? value;
  if (candidate === null || candidate === undefined || candidate === '') return emptyLabel;
  if (typeof candidate === 'boolean') return candidate ? 'Sim' : 'Não';
  if (typeof candidate === 'string' || typeof candidate === 'number') return String(candidate);
  return emptyLabel;
}

function priority(value: unknown) {
  const raw = readableValue(value);
  return priorityLabels[raw] ?? raw;
}

export function formatItemHistory(record: ItemHistoryRecord): string {
  const actor = record.user?.name || 'Alguém';
  const oldValue = readableValue(record.old_value);
  const newValue = readableValue(record.new_value);

  try {
    switch (record.event_type) {
      case 'ITEM_CREATED':
        return `${actor} criou o item.`;
      case 'TITLE_CHANGED':
        return `${actor} alterou o título de “${oldValue}” para “${newValue}”.`;
      case 'DESCRIPTION_CHANGED':
        return `${actor} alterou a descrição.`;
      case 'STATUS_CHANGED':
        return `${actor} alterou o status de ${oldValue} para ${newValue}.`;
      case 'PRIORITY_CHANGED':
        return `${actor} alterou a prioridade de ${priority(record.old_value)} para ${priority(record.new_value)}.`;
      case 'ASSIGNEE_CHANGED':
        if (newValue === 'não informado') return `${actor} removeu o responsável pelo item.`;
        if (oldValue === 'não informado') return `${actor} atribuiu o item a ${newValue}.`;
        return `${actor} alterou o responsável de ${oldValue} para ${newValue}.`;
      case 'SPRINT_CHANGED':
        if (newValue === 'não informado') return `${actor} removeu o item da sprint ${oldValue}.`;
        if (oldValue === 'não informado') return `${actor} adicionou o item à sprint ${newValue}.`;
        return `${actor} moveu o item da sprint ${oldValue} para ${newValue}.`;
      case 'ESTIMATE_CHANGED':
        if (record.field === 'story_points') return `${actor} alterou os story points de ${oldValue} para ${newValue}.`;
        return `${actor} alterou a estimativa de ${oldValue} para ${newValue}.`;
      case 'ACCEPTANCE_CRITERIA_CHANGED':
        return `${actor} alterou os critérios de aceitação.`;
      case 'COMMENT_CREATED':
        return `${actor} adicionou um comentário.`;
      case 'COMMENT_EDITED':
        return `${actor} editou um comentário.`;
      case 'COMMENT_DELETED':
        return `${actor} excluiu um comentário.`;
      case 'ATTACHMENT_UPLOADED':
        return `${actor} adicionou um anexo.`;
      case 'ATTACHMENT_DOWNLOADED':
        return `${actor} baixou um anexo.`;
      case 'ATTACHMENT_DELETED':
        return `${actor} excluiu um anexo.`;
      case 'BUG_RETEST_RECORDED': {
        const result = String(objectValue(record.new_value, 'result') || 'NOT_TESTED');
        const labels: Record<string, string> = { APPROVED: 'aprovado', FAILED: 'falhou', BLOCKED: 'bloqueado', NOT_TESTED: 'não testado' };
        return `${actor} registrou um reteste: ${labels[result] || result}.`;
      }
      case 'BUG_REOPENED':
        return `${actor} reabriu o bug após falha no reteste.`;
      default:
        return `${actor} realizou uma alteração no item.`;
    }
  } catch {
    return `${actor} realizou uma alteração no item.`;
  }
}

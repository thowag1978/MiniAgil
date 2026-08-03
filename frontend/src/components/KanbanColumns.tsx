'use client';

import React, { useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { itemsApi } from '@/lib/api/items';
import type { Item, ItemType, WorkflowStatus } from '@/lib/types';
import styles from '@/app/dashboard/board/board.module.css';

export type KanbanColumnDefinition = {
  status: WorkflowStatus;
  itemType: ItemType;
  wipLimit?: number | null;
};

export default function KanbanColumns({ columns, items, variant = 'general', onOpen, onMoved }: {
  columns: KanbanColumnDefinition[];
  items: Item[];
  variant?: 'general' | 'bugs';
  onOpen: (item: Item) => void;
  onMoved: () => Promise<unknown> | void;
}) {
  const [draggedItem, setDraggedItem] = useState<Item | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [referenceTime] = useState(() => Date.now());

  const moveItem = async (statusId: string, targetItemType: ItemType, targetIndex: number) => {
    if (!draggedItem || draggedItem.workflow_status_id === statusId) return;
    if (draggedItem.type !== targetItemType) return window.alert('O status de destino pertence a outro tipo de item.');
    setMovingItemId(draggedItem.id);
    try {
      let response;
      try {
        response = await itemsApi.moveOnBoard(draggedItem.id, { workflow_status_id: statusId, target_index: targetIndex, expected_updated_at: draggedItem.updatedAt });
      } catch (error) {
        if (!(error instanceof ApiError) || !error.message.toLowerCase().includes('requires a comment')) throw error;
        const comment = window.prompt('Esta transição exige um comentário:');
        if (!comment?.trim()) return;
        response = await itemsApi.moveOnBoard(draggedItem.id, {
          workflow_status_id: statusId, target_index: targetIndex,
          expected_updated_at: draggedItem.updatedAt, transition_comment: comment.trim(),
        });
      }
      if (response.warnings.length) window.alert(response.warnings.map(({ message }) => message).join('\n'));
      await onMoved();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível mover o item.');
    } finally {
      setMovingItemId(null);
      setDraggedItem(null);
    }
  };

  const daysOpen = (item: Item) => Math.max(0, Math.floor((referenceTime - new Date(item.createdAt).getTime()) / 86400000));
  const cardValue = (value: NonNullable<Item['custom_field_values']>[number]) => {
    if (Array.isArray(value.value)) return value.value.map(entry => value.field.options.find(option => option.value === entry)?.label || entry).join(', ');
    if (value.field.field_type === 'SELECT') return value.field.options.find(option => option.value === value.value)?.label || String(value.value);
    if (value.field.field_type === 'BOOLEAN') return value.value ? 'Sim' : 'Não';
    return String(value.value ?? '—');
  };

  return (
    <div className={styles.boardColumns}>
      {columns.map(({ status, itemType, wipLimit }) => {
        const columnItems = items.filter((item) => item.workflow_status_id === status.id);
        return (
          <div key={status.id} className={styles.column} onDragOver={(event) => event.preventDefault()} onDrop={() => moveItem(status.id, itemType, columnItems.length)}>
            <div className={styles.columnHeader}><h3>{status.name}{variant === 'general' ? ` · ${itemType}` : ''}</h3><span className={styles.count} style={wipLimit && columnItems.length > wipLimit ? { color: '#fca5a5' } : undefined}>{columnItems.length}{wipLimit ? ` / ${wipLimit}` : ''}</span></div>
            <div className={styles.columnContent}>
              {columnItems.map((item, index) => {
                const critical = item.bug_details?.severity === 'CRITICAL' || item.bug_details?.severity === 'BLOCKER';
                return (
                  <div key={item.id} className={`${styles.ticketCard} ${critical ? styles.criticalBug : ''}`} draggable onDragStart={() => setDraggedItem(item)} onDragEnd={() => setDraggedItem(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); moveItem(status.id, itemType, index); }} onClick={() => onOpen(item)} aria-busy={movingItemId === item.id}>
                    {variant === 'bugs' ? (
                      <>
                        <div className={styles.tagRow}><span className={styles.bugSeverity}>{item.bug_details?.severity || 'MEDIUM'}</span><span className={styles.sprintTag}>{item.bug_details?.environment || 'TEST'}</span></div>
                        <div className={styles.ticketTitle}>{item.title}</div>
                        <div className={styles.bugMeta}><span>{item.assignee?.name || 'Não atribuído'}</span><span>{daysOpen(item)} dia(s) em aberto</span></div>
                      </>
                    ) : (
                      <>
                        <div className={styles.tagRow}><div className={styles.projectTag}>{item.project?.name || item.project?.key_prefix || item.project_key.split('-')[0]}</div><div className={`${styles.sprintTag} ${item.sprint ? styles.sprintAssigned : styles.sprintEmpty}`}>{item.sprint?.name || 'Sem sprint'}</div></div>
                        <div className={styles.ticketTitle}>{item.title}</div>
                        <div className={styles.ticketFooter}><span className={`${styles.ticketType} ${item.type === 'BUG' ? styles.typeBug : item.type === 'STORY' ? styles.typeStory : styles.typeTask}`}>{item.type}</span><span className={styles.ticketKey}>{item.project_key}</span></div>
                      </>
                    )}
                    {(item.custom_field_values || []).filter(value => value.field.show_on_card && value.field.is_active).map(value => <small key={value.id}>{value.field.name}: {cardValue(value)}</small>)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

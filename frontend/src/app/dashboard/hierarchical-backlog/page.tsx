'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './hierarchical.module.css';
import HierarchicalItemModal from '../../../components/HierarchicalItemModal';
import { projectsApi } from '@/lib/api/projects';
import { itemsApi } from '@/lib/api/items';
import { queryKeys } from '@/lib/query/keys';
import type { Item } from '@/lib/types';

interface TreeItem extends Item {
  children: TreeItem[];
}

export default function HierarchicalBacklog() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'CREATE' | 'EDIT';
    type: 'EPIC' | 'STORY' | 'TASK';
    parentData?: TreeItem;
    initialData?: TreeItem;
  }>({ isOpen: false, mode: 'CREATE', type: 'EPIC' });

  const projectsQuery = useQuery({ queryKey: queryKeys.projects, queryFn: () => projectsApi.list() });
  const projectId = projectsQuery.data?.[0]?.id || '';

  const itemsQuery = useQuery({
    queryKey: queryKeys.hierarchicalItems(projectId || 'none'),
    queryFn: () => itemsApi.listHierarchical(projectId),
    enabled: Boolean(projectId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalItems(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.items });
      queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(projectId) });
    },
    onError: (error: Error) => {
      alert(`Erro: ${error.message}`);
    },
  });

  const items = (itemsQuery.data || []) as TreeItem[];

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = (id: string, hasChildren: boolean) => {
    if (hasChildren) {
      alert('Não é possível excluir um item que possui filhos vinculados.');
      return;
    }
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    deleteMutation.mutate(id);
  };

  const filterItem = (item: TreeItem): boolean => {
    const matchSearch = item.title.toLowerCase().includes(search.toLowerCase()) || item.project_key.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter ? item.priority === priorityFilter : true;
    const matchStatus = statusFilter ? item.workflow_status?.name === statusFilter : true;
    return matchSearch && matchPriority && matchStatus;
  };

  const hasMatchingChild = (item: TreeItem): boolean => {
    if (filterItem(item)) return true;
    if (item.children && item.children.length > 0) {
      return item.children.some((child) => hasMatchingChild(child));
    }
    return false;
  };

  const renderItem = (item: TreeItem, type: 'EPIC' | 'STORY' | 'TASK') => {
    if (!hasMatchingChild(item)) return null;

    const isExpanded = expanded.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const icons = { EPIC: 'EP', STORY: 'ST', TASK: 'TS' };
    const classes = { EPIC: styles.epic, STORY: styles.story, TASK: styles.task };

    return (
      <div key={item.id} className={styles.treeNode}>
        <div className={`${styles.nodeContent} ${classes[type]}`}>
          <button className={`${styles.expandBtn} ${!hasChildren ? styles.hidden : ''} ${isExpanded ? styles.expanded : ''}`} onClick={() => toggleExpand(item.id)}>▶</button>
          <div className={styles.nodeIcon}>{icons[type]}</div>
          <div className={styles.nodeInfo}>
            <div className={styles.nodeTitle}>
              <span style={{ color: 'var(--primary-color)' }}>{item.project_key}</span>
              {item.title}
            </div>
            <div className={styles.nodeMeta}>
              <span>Status: {item.workflow_status?.name || '---'}</span>
              <span>Prioridade: {item.priority}</span>
              {item.assignee && <span>Resp: {item.assignee.name}</span>}
              {type === 'TASK' && item.estimate && <span>Estimativa: {item.estimate} pt(s)</span>}
            </div>
          </div>
          <div className={styles.nodeActions}>
            {type === 'EPIC' && <button className={styles.actionBtn} onClick={() => setModalState({ isOpen: true, mode: 'CREATE', type: 'STORY', parentData: item })}>+ História</button>}
            {type === 'STORY' && <button className={styles.actionBtn} onClick={() => setModalState({ isOpen: true, mode: 'CREATE', type: 'TASK', parentData: item })}>+ Atividade</button>}
            <button className={styles.actionBtn} onClick={() => setModalState({ isOpen: true, mode: 'EDIT', type, initialData: item })}>Editar</button>
            <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => handleDelete(item.id, hasChildren)}>Excluir</button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className={styles.childrenContainer}>
            {item.children.map((child) => renderItem(child, type === 'EPIC' ? 'STORY' : 'TASK'))}
          </div>
        )}
      </div>
    );
  };

  let content: React.ReactNode;
  if (projectsQuery.isLoading || itemsQuery.isLoading) {
    content = <div className={styles.emptyState}>Carregando backlog...</div>;
  } else if (projectsQuery.isError || itemsQuery.isError) {
    content = <div className={styles.emptyState}>Erro ao carregar backlog.</div>;
  } else if (!projectId) {
    content = <div className={styles.emptyState}>Nenhum projeto encontrado.</div>;
  } else if (items.length === 0) {
    content = (
      <div className={styles.emptyState}>
        <h3>Nenhum Épico encontrado</h3>
        <p>Comece criando o primeiro Épico do seu projeto.</p>
      </div>
    );
  } else {
    content = items.map(epic => renderItem(epic, 'EPIC'));
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '5px' }}>Backlog Hierárquico</h1>
          <p style={{ color: 'var(--text-dim)' }}>Gerencie Épicos, Histórias e Atividades em estrutura de árvore</p>
        </div>
        <button className="btn-primary" onClick={() => setModalState({ isOpen: true, mode: 'CREATE', type: 'EPIC' })} disabled={!projectId}>+ Novo Épico</button>
      </header>

      <div className={styles.filters}>
        <input className="input-glass" placeholder="Buscar item..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '250px' }} />
        <select className="input-glass" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">Todas Prioridades</option>
          <option value="CRITICAL">Crítica</option>
          <option value="HIGH">Alta</option>
          <option value="MEDIUM">Média</option>
          <option value="LOW">Baixa</option>
        </select>
        <select className="input-glass" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Todos Status</option>
          <option value="A FAZER">A FAZER</option>
          <option value="EM PROGRESSO">EM PROGRESSO</option>
          <option value="CONCLUÍDO">CONCLUÍDO</option>
        </select>
      </div>

      <div className={styles.treeContainer} style={{ marginTop: '20px' }}>{content}</div>

      {modalState.isOpen && (
        <HierarchicalItemModal
          onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
          onSuccess={() => {
            setModalState(prev => ({ ...prev, isOpen: false }));
            if (projectId) {
              queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalItems(projectId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.items });
            }
          }}
          mode={modalState.mode}
          type={modalState.type}
          parentData={modalState.parentData}
          initialData={modalState.initialData}
        />
      )}
    </div>
  );
}



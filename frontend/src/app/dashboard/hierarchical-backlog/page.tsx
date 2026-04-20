'use client';
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import styles from './hierarchical.module.css';
import HierarchicalItemModal from '../../../components/HierarchicalItemModal';
import { itemsApi } from '@/lib/api/items';
import { queryKeys } from '@/lib/query/keys';
import type { Item, ProjectHierarchy } from '@/lib/types';

interface TreeItem extends Item {
  children: TreeItem[];
}

interface TreeProject extends ProjectHierarchy {
  epics: TreeItem[];
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
    projectData?: { id: string; name: string; key_prefix: string };
    parentData?: TreeItem;
    initialData?: TreeItem;
  }>({ isOpen: false, mode: 'CREATE', type: 'EPIC' });

  const treeQuery = useQuery({
    queryKey: queryKeys.hierarchicalTree,
    queryFn: () => itemsApi.listHierarchicalTree(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalTree });
      queryClient.invalidateQueries({ queryKey: queryKeys.items });
      queryClient.invalidateQueries({ queryKey: ['items', 'backlog-overview'] });
    },
    onError: (error: Error) => {
      alert(`Erro: ${error.message}`);
    },
  });

  const projects = (treeQuery.data || []) as TreeProject[];

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
    const query = search.toLowerCase();
    const matchSearch = item.title.toLowerCase().includes(query) || item.project_key.toLowerCase().includes(query);
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

  const projectMatches = (project: TreeProject): boolean => {
    const query = search.toLowerCase();
    const projectMatch = !query ||
      project.name.toLowerCase().includes(query) ||
      project.key_prefix.toLowerCase().includes(query);
    if (projectMatch && !priorityFilter && !statusFilter) return true;
    return project.epics.some((epic) => hasMatchingChild(epic));
  };

  const renderItem = (item: TreeItem, type: 'EPIC' | 'STORY' | 'TASK') => {
    if (!hasMatchingChild(item)) return null;

    const nodeId = `item-${item.id}`;
    const isExpanded = expanded.has(nodeId);
    const hasChildren = item.children && item.children.length > 0;
    const icons = { EPIC: 'EP', STORY: 'ST', TASK: 'TS' };
    const classes = { EPIC: styles.epic, STORY: styles.story, TASK: styles.task };

    return (
      <div key={item.id} className={styles.treeNode}>
        <div className={`${styles.nodeContent} ${classes[type]}`}>
          <button
            className={`${styles.expandBtn} ${!hasChildren ? styles.hidden : ''} ${isExpanded ? styles.expanded : ''}`}
            onClick={() => toggleExpand(nodeId)}
          >
            ▶
          </button>
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
            {type === 'EPIC' && (
              <button
                className={styles.actionBtn}
                onClick={() => setModalState({ isOpen: true, mode: 'CREATE', type: 'STORY', parentData: item })}
              >
                + História
              </button>
            )}
            {type === 'STORY' && (
              <button
                className={styles.actionBtn}
                onClick={() => setModalState({ isOpen: true, mode: 'CREATE', type: 'TASK', parentData: item })}
              >
                + Atividade
              </button>
            )}
            <button className={styles.actionBtn} onClick={() => setModalState({ isOpen: true, mode: 'EDIT', type, initialData: item })}>
              Editar
            </button>
            <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => handleDelete(item.id, hasChildren)}>
              Excluir
            </button>
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

  const renderProject = (project: TreeProject) => {
    if (!projectMatches(project)) return null;

    const projectNodeId = `project-${project.id}`;
    const hasChildren = project.epics.length > 0;
    const isExpanded = expanded.has(projectNodeId);

    return (
      <div key={project.id} className={styles.treeNode}>
        <div className={`${styles.nodeContent} ${styles.project}`}>
          <button
            className={`${styles.expandBtn} ${!hasChildren ? styles.hidden : ''} ${isExpanded ? styles.expanded : ''}`}
            onClick={() => toggleExpand(projectNodeId)}
          >
            ▶
          </button>
          <div className={styles.nodeIcon}>PR</div>
          <div className={styles.nodeInfo}>
            <div className={styles.nodeTitle}>
              <span style={{ color: 'var(--primary-color)' }}>{project.key_prefix}</span>
              {project.name}
            </div>
            <div className={styles.nodeMeta}>
              <span>Projeto</span>
              <span>{project.epics.length} épico(s)</span>
            </div>
          </div>
          <div className={styles.nodeActions}>
            <button
              className={styles.actionBtn}
              onClick={() => setModalState({
                isOpen: true,
                mode: 'CREATE',
                type: 'EPIC',
                projectData: { id: project.id, name: project.name, key_prefix: project.key_prefix },
              })}
            >
              + Épico
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className={styles.childrenContainer}>
            {project.epics.map((epic) => renderItem(epic, 'EPIC'))}
          </div>
        )}
      </div>
    );
  };

  const defaultProject = projects[0];

  let content: React.ReactNode;
  if (treeQuery.isLoading) {
    content = <div className={styles.emptyState}>Carregando backlog...</div>;
  } else if (treeQuery.isError) {
    content = <div className={styles.emptyState}>Erro ao carregar backlog.</div>;
  } else if (projects.length === 0) {
    content = <div className={styles.emptyState}>Nenhum projeto encontrado.</div>;
  } else {
    const rendered = projects.map(renderProject).filter(Boolean);
    content = rendered.length > 0 ? rendered : (
      <div className={styles.emptyState}>
        <h3>Nenhum item encontrado</h3>
        <p>Ajuste os filtros para exibir resultados.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '5px' }}>Backlog Hierárquico</h1>
          <p style={{ color: 'var(--text-dim)' }}>Gerencie Projeto, Épicos, Histórias e Atividades em estrutura de árvore</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => defaultProject && setModalState({
            isOpen: true,
            mode: 'CREATE',
            type: 'EPIC',
            projectData: { id: defaultProject.id, name: defaultProject.name, key_prefix: defaultProject.key_prefix },
          })}
          disabled={!defaultProject}
        >
          + Novo Épico
        </button>
      </header>

      <div className={styles.filters}>
        <input
          className="input-glass"
          placeholder="Buscar projeto, épico, história ou atividade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '300px' }}
        />
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
            queryClient.invalidateQueries({ queryKey: queryKeys.hierarchicalTree });
            queryClient.invalidateQueries({ queryKey: queryKeys.items });
          }}
          mode={modalState.mode}
          type={modalState.type}
          projectData={modalState.projectData}
          parentData={modalState.parentData}
          initialData={modalState.initialData}
        />
      )}
    </div>
  );
}

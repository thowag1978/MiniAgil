'use client';
import React, { useState, useEffect } from 'react';
import styles from './hierarchical.module.css';
import HierarchicalItemModal from '../../../components/HierarchicalItemModal';

export default function HierarchicalBacklog() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'CREATE' | 'EDIT';
    type: 'EPIC' | 'STORY' | 'TASK';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentData?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialData?: any;
    projectId?: string;
  }>({ isOpen: false, mode: 'CREATE', type: 'EPIC' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // 1. Get Projects
      const projRes = await fetch('http://localhost:4000/api/projects', { headers });
      if (!projRes.ok) throw new Error('Failed to fetch project');
      const projects = await projRes.json();
      setProjects(projects);
      if (projects.length === 0) {
        setItems([]);
        setProjectId('');
        setLoading(false);
        return;
      }
      const pId = projects[0].id;
      setProjectId(pId);

      // 2. Get all backlog items for all user projects
      const itemsRes = await fetch('http://localhost:4000/api/items', { headers });
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data);
        const expandedIds = new Set<string>(projects.map((project: any) => project.id));
        data.forEach((item: any) => {
          if (item.type === 'EPIC' || item.type === 'STORY') expandedIds.add(item.id);
        });
        setExpanded(expandedIds);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string, hasChildren: boolean) => {
    if (hasChildren) {
      alert('Não é possível excluir um item que possui filhos vinculados.');
      return;
    }
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/api/items/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede ao excluir');
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterItem = (item: any): boolean => {
    const searchText = `${item.title} ${item.project_key} ${item.project?.name || ''} ${item.project?.key_prefix || ''}`.toLowerCase();
    const matchSearch = searchText.includes(search.toLowerCase());
    const matchPriority = priorityFilter ? item.priority === priorityFilter : true;
    const matchStatus = statusFilter ? item.workflow_status?.name === statusFilter : true;
    return matchSearch && matchPriority && matchStatus;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasMatchingChild = (item: any): boolean => {
    if (filterItem(item)) return true;
    if (item.children && item.children.length > 0) {
      return item.children.some((child: any) => hasMatchingChild(child));
    }
    return false;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderItem = (item: any, type: 'EPIC'|'STORY'|'TASK') => {
    if (!hasMatchingChild(item)) return null;

    const isExpanded = expanded.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const icons = { EPIC: '👑', STORY: '📖', TASK: '✅' };
    const classes = { EPIC: styles.epic, STORY: styles.story, TASK: styles.task };

    return (
      <div key={item.id} className={styles.treeNode}>
        <div className={`${styles.nodeContent} ${classes[type]}`}>
          <button 
            className={`${styles.expandBtn} ${!hasChildren ? styles.hidden : ''} ${isExpanded ? styles.expanded : ''}`}
            onClick={() => toggleExpand(item.id)}
          >
            ▶
          </button>
          <div className={styles.nodeIcon}>{icons[type]}</div>
          <div className={styles.nodeInfo}>
            <div className={styles.nodeTitle}>
              <span style={{ color: 'var(--primary-color)' }}>{item.project_key}</span>
              {item.project?.name && <span className={styles.projectBadge}>{item.project.name}</span>}
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
            <button 
              className={styles.actionBtn}
              onClick={() => setModalState({ isOpen: true, mode: 'EDIT', type, initialData: item })}
            >
              Editar
            </button>
            <button 
              className={`${styles.actionBtn} ${styles.danger}`}
              onClick={() => handleDelete(item.id, hasChildren)}
            >
              Excluir
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className={styles.childrenContainer}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {item.children.map((child: any) => renderItem(child, child.type))}
          </div>
        )}
      </div>
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildProjectTree = (project: any) => {
    const backlogTypes = new Set(['EPIC', 'STORY', 'TASK']);
    const projectItems = items.filter(item => item.project_id === project.id && backlogTypes.has(item.type));
    const itemMap = new Map(projectItems.map(item => [item.id, { ...item, children: [] as any[] }]));
    const attachedIds = new Set<string>();

    itemMap.forEach(item => {
      if (item.parent_id && itemMap.has(item.parent_id)) {
        itemMap.get(item.parent_id).children.push(item);
        attachedIds.add(item.id);
      }
    });

    const typeOrder = { EPIC: 0, STORY: 1, TASK: 2 };
    const sortItems = (a: any, b: any) => {
      const typeDiff = typeOrder[a.type as keyof typeof typeOrder] - typeOrder[b.type as keyof typeof typeOrder];
      if (typeDiff !== 0) return typeDiff;
      return String(a.project_key).localeCompare(String(b.project_key), undefined, { numeric: true });
    };

    itemMap.forEach(item => item.children.sort(sortItems));
    return Array.from(itemMap.values())
      .filter(item => item.type === 'EPIC' || !attachedIds.has(item.id))
      .sort(sortItems);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderProject = (project: any) => {
    const projectItems = buildProjectTree(project);
    const projectSearchText = `${project.name} ${project.key_prefix}`.toLowerCase();
    const projectMatchesSearch = search && projectSearchText.includes(search.toLowerCase());
    const matchingItems = projectMatchesSearch && !priorityFilter && !statusFilter
      ? projectItems
      : projectItems.filter(item => hasMatchingChild(item));
    const hasFilters = Boolean(search || priorityFilter || statusFilter);
    if (hasFilters && matchingItems.length === 0) return null;

    return (
      <section key={project.id} className={styles.projectSection}>
        <div className={styles.projectHeader}>
          <div>
            <div className={styles.projectTitle}>{project.name}</div>
            <div className={styles.projectMeta}>
              {project.key_prefix} - {projectItems.length} item(ns) de backlog
            </div>
          </div>
          <button
            className={styles.actionBtn}
            onClick={() => setModalState({ isOpen: true, mode: 'CREATE', type: 'EPIC', projectId: project.id })}
          >
            + Epico
          </button>
        </div>
        <div className={styles.projectItems}>
          {matchingItems.length > 0 ? (
            matchingItems.map(item => renderItem(item, item.type))
          ) : (
            <div className={styles.projectEmpty}>Nenhum item de backlog neste projeto.</div>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 600, marginBottom: '5px' }}>Backlog Hierárquico</h1>
          <p style={{ color: 'var(--text-dim)' }}>Gerencie Épicos, Histórias e Atividades em estrutura de árvore</p>
        </div>
        <button 
          className="btn-primary"
          onClick={() => setModalState({ isOpen: true, mode: 'CREATE', type: 'EPIC', projectId })}
          disabled={!projectId}
        >
          + Novo Épico
        </button>
      </header>

      <div className={styles.filters}>
        <input 
          className="input-glass" 
          placeholder="Buscar item..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '250px' }}
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
          <option value="EM ANDAMENTO">EM ANDAMENTO</option>
          <option value="CONCLUIDO">CONCLUIDO</option>
        </select>
      </div>

      <div className={styles.treeContainer} style={{ marginTop: '20px' }}>
        {loading ? (
          <div className={styles.emptyState}>Carregando backlog...</div>
        ) : projects.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>Nenhum Épico encontrado</h3>
            <p>Comece criando o primeiro Épico do seu projeto.</p>
          </div>
        ) : (
          projects.map(renderProject)
        )}
      </div>

      {modalState.isOpen && (
        <HierarchicalItemModal
          onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
          onSuccess={() => {
            setModalState(prev => ({ ...prev, isOpen: false }));
            fetchData();
          }}
          mode={modalState.mode}
          type={modalState.type}
          parentData={modalState.parentData}
          initialData={modalState.initialData}
          projectId={modalState.projectId}
        />
      )}
    </div>
  );
}

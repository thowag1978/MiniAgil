'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '@/lib/api/items';
import { projectsApi } from '@/lib/api/projects';
import { sprintsApi } from '@/lib/api/sprints';
import { queryKeys } from '@/lib/query/keys';
import type { Item, SprintStatus } from '@/lib/types';
import styles from './sprint.module.css';
import { SprintMetricsPanel } from './SprintMetricsPanel';

const statusLabel: Record<SprintStatus, string> = {
  PLANNED: 'Planejada',
  ACTIVE: 'Ativa',
  FINISHED: 'Concluída',
  CANCELLED: 'Cancelada',
};

function formatDate(value?: string | null) {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleDateString('pt-BR');
}

function storyPoints(stories: Item[]) {
  return stories.reduce((total, story) => total + (story.story_points || 0), 0);
}

function StoryRow({
  story,
  checked,
  disabled,
  onToggle,
  onDragStart,
}: {
  story: Item;
  checked: boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
  onDragStart: (story: Item) => void;
}) {
  return (
    <label className={`${styles.storyRow} ${disabled ? styles.storyRowDisabled : ''}`} draggable={!disabled} onDragStart={() => onDragStart(story)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(story.id)}
      />
      <span className={styles.storyKey}>{story.project_key}</span>
      <span className={styles.storyTitle}>{story.title}</span>
      <span className={styles.storyMeta}>{story.assignee?.name || 'Sem responsável'} · {story.story_points ? `${story.story_points} SP` : 'Sem estimativa'}</span>
    </label>
  );
}

export default function SprintPage() {
  const queryClient = useQueryClient();
  const [selectedProjectIdOverride, setSelectedProjectIdOverride] = useState('');
  const [selectedSprintIdOverride, setSelectedSprintIdOverride] = useState('');
  const [selectedBacklogStoryIds, setSelectedBacklogStoryIds] = useState<string[]>([]);
  const [selectedSprintStoryIds, setSelectedSprintStoryIds] = useState<string[]>([]);
  const [pendingDestination, setPendingDestination] = useState<'BACKLOG' | 'SPRINT'>('BACKLOG');
  const [targetSprintId, setTargetSprintId] = useState('');
  const [draggedStory, setDraggedStory] = useState<Item | null>(null);
  const [epicFilter, setEpicFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [form, setForm] = useState({
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => projectsApi.list(),
  });

  const projects = projectsQuery.data || [];
  const selectedProjectId = projects.some((project) => project.id === selectedProjectIdOverride)
    ? selectedProjectIdOverride
    : projects[0]?.id || '';

  const sprintsQuery = useQuery({
    queryKey: queryKeys.sprints(selectedProjectId || 'none'),
    queryFn: () => sprintsApi.list(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const storiesQuery = useQuery({
    queryKey: queryKeys.itemsByFilter(`project:${selectedProjectId}:stories`),
    queryFn: () => itemsApi.list({ project_id: selectedProjectId, type: 'STORY', backlog: true }),
    enabled: Boolean(selectedProjectId),
  });

  const sprints = useMemo(() => sprintsQuery.data || [], [sprintsQuery.data]);
  const defaultSprint = sprints.find((sprint) => sprint.status === 'ACTIVE')
    || sprints.find((sprint) => sprint.status === 'PLANNED')
    || sprints[0];
  const selectedSprintId = sprints.some((sprint) => sprint.id === selectedSprintIdOverride)
    ? selectedSprintIdOverride
    : defaultSprint?.id || '';
  const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId) || null;
  const metricsQuery = useQuery({ queryKey: ['sprint-metrics', selectedSprintId], queryFn: () => sprintsApi.metrics(selectedSprintId), enabled: Boolean(selectedSprintId && selectedSprint?.status !== 'PLANNED') });
  const velocityQuery = useQuery({ queryKey: ['sprint-velocity', selectedProjectId], queryFn: () => sprintsApi.velocity(selectedProjectId), enabled: Boolean(selectedProjectId) });

  const stories = useMemo(() => storiesQuery.data || [], [storiesQuery.data]);
  const backlogStories = useMemo(() => stories.filter((story) => !story.sprint_id), [stories]);
  const sprintStories = useMemo(
    () => stories.filter((story) => story.sprint_id === selectedSprintId),
    [selectedSprintId, stories],
  );
  const otherSprintStories = useMemo(
    () => stories.filter((story) => story.sprint_id && story.sprint_id !== selectedSprintId),
    [selectedSprintId, stories],
  );
  const filteredBacklogStories = useMemo(() => backlogStories.filter((story) =>
    (!epicFilter || story.parent_id === epicFilter) && (!assigneeFilter || story.assignee_id === assigneeFilter)), [backlogStories, epicFilter, assigneeFilter]);
  const filteredSprintStories = useMemo(() => sprintStories.filter((story) =>
    (!epicFilter || story.parent_id === epicFilter) && (!assigneeFilter || story.assignee_id === assigneeFilter)), [sprintStories, epicFilter, assigneeFilter]);
  const epics = Array.from(new Map(stories.filter((story) => story.parent).map((story) => [story.parent!.id, story.parent!])).values());
  const members = projects.find((project) => project.id === selectedProjectId)?.members || [];

  const refreshSprintData = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sprints(selectedProjectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.itemsByFilter(`project:${selectedProjectId}:stories`) });
    queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(selectedProjectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.items });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
    queryClient.invalidateQueries({ queryKey: ['sprint-metrics', selectedSprintId] });
    queryClient.invalidateQueries({ queryKey: ['sprint-velocity', selectedProjectId] });
  };

  const createSprintMutation = useMutation({
    mutationFn: () => sprintsApi.create({
      project_id: selectedProjectId,
      name: form.name.trim(),
      goal: form.goal.trim() || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    }),
    onSuccess: (sprint) => {
      setForm({ name: '', goal: '', startDate: '', endDate: '' });
      setSelectedSprintIdOverride(sprint.id);
      refreshSprintData();
    },
  });

  const assignStoriesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSprintId) return;
      await Promise.all(selectedBacklogStoryIds.map((id) => sprintsApi.addItem(selectedSprintId, id)));
    },
    onSuccess: () => {
      setSelectedBacklogStoryIds([]);
      refreshSprintData();
    },
  });

  const removeStoriesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSprintId) return;
      await Promise.all(selectedSprintStoryIds.map((id) => sprintsApi.removeItem(selectedSprintId, id)));
    },
    onSuccess: () => {
      setSelectedSprintStoryIds([]);
      refreshSprintData();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: SprintStatus) => {
      if (!selectedSprintId) throw new Error('Selecione uma sprint.');
      return sprintsApi.updateStatus(selectedSprintId, status, status === 'FINISHED' ? {
        pending_destination: pendingDestination,
        ...(pendingDestination === 'SPRINT' && targetSprintId ? { target_sprint_id: targetSprintId } : {}),
      } : undefined);
    },
    onSuccess: refreshSprintData,
  });
  const moveStoryMutation = useMutation({
    mutationFn: ({ story, destination }: { story: Item; destination: 'BACKLOG' | 'SPRINT' }) => {
      if (!selectedSprintId) throw new Error('Selecione uma sprint.');
      return destination === 'SPRINT'
        ? sprintsApi.addItem(selectedSprintId, story.id)
        : sprintsApi.removeItem(selectedSprintId, story.id);
    },
    onSuccess: () => { setDraggedStory(null); refreshSprintData(); },
    onError: (error: Error) => { setDraggedStory(null); window.alert(error.message); },
  });

  const toggleBacklogStory = (id: string) => {
    setSelectedBacklogStoryIds((current) => current.includes(id) ? current.filter((storyId) => storyId !== id) : [...current, id]);
  };

  const toggleSprintStory = (id: string) => {
    setSelectedSprintStoryIds((current) => current.includes(id) ? current.filter((storyId) => storyId !== id) : [...current, id]);
  };

  const isLoading = projectsQuery.isLoading || sprintsQuery.isLoading || storiesQuery.isLoading;
  const isError = projectsQuery.isError || sprintsQuery.isError || storiesQuery.isError;
  const canPlanStories = Boolean(selectedSprint) && selectedSprint?.status !== 'FINISHED' && selectedSprint?.status !== 'CANCELLED';

  if (isLoading) return <div style={{ padding: 16 }}>Carregando planejamento da sprint...</div>;
  if (isError) return <div style={{ padding: 16, color: '#ff6b6b' }}>Não foi possível carregar as informações de sprint.</div>;

  return (
    <div className={`animate-fade-in ${styles.container}`}>
      <div className={styles.header}>
        <div>
          <h1>Sprint</h1>
          <p>Planeje uma iteração com objetivo, janela de execução e histórias selecionadas do backlog.</p>
        </div>
        <select
          className={styles.select}
          value={selectedProjectId}
          onChange={(event) => {
            setSelectedProjectIdOverride(event.target.value);
            setSelectedSprintIdOverride('');
            setSelectedBacklogStoryIds([]);
            setSelectedSprintStoryIds([]);
            setEpicFilter('');
            setAssigneeFilter('');
          }}
        >
          {projectsQuery.data?.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
      </div>

      {!selectedProjectId ? (
        <div className={styles.emptyState}>Crie um projeto antes de planejar uma sprint.</div>
      ) : (
        <>
          <section className={styles.createPanel}>
            <div className={styles.panelHeader}>
              <h2>Nova Sprint</h2>
              <span>Começa como planejada; depois pode ser iniciada e concluída.</span>
            </div>
            <form
              className={styles.formGrid}
              onSubmit={(event) => {
                event.preventDefault();
                if (form.name.trim()) createSprintMutation.mutate();
              }}
            >
              <input
                className="input-glass"
                placeholder="Nome da sprint"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
              <input
                className="input-glass"
                placeholder="Objetivo da sprint"
                value={form.goal}
                onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))}
              />
              <input
                className="input-glass"
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
              />
              <input
                className="input-glass"
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
              />
              <button className="btn-primary" disabled={createSprintMutation.isPending || !form.name.trim()}>
                Criar Sprint
              </button>
            </form>
          </section>

          <section className={styles.sprintToolbar}>
            <div className={styles.sprintPicker}>
              <label>Sprint selecionada</label>
              <select
                className={styles.select}
                value={selectedSprintId}
                onChange={(event) => {
                  setSelectedSprintIdOverride(event.target.value);
                  setSelectedBacklogStoryIds([]);
                  setSelectedSprintStoryIds([]);
                }}
                disabled={sprints.length === 0}
              >
                {sprints.length === 0 ? (
                  <option value="">Nenhuma sprint criada</option>
                ) : sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name} - {statusLabel[sprint.status]}
                  </option>
                ))}
              </select>
            </div>

            {selectedSprint && (
              <div className={styles.sprintSummary}>
                <span className={`${styles.statusBadge} ${styles[`status${selectedSprint.status}`]}`}>{statusLabel[selectedSprint.status]}</span>
                <strong>{sprintStories.length} histórias</strong>
                <strong>{storyPoints(sprintStories)} pontos</strong>
                <span>{formatDate(selectedSprint.startDate)} até {formatDate(selectedSprint.endDate)}</span>
              </div>
            )}

            {selectedSprint?.status === 'ACTIVE' && <div className={styles.finishOptions}>
              <select className={styles.select} value={pendingDestination} onChange={(event) => { setPendingDestination(event.target.value as 'BACKLOG' | 'SPRINT'); setTargetSprintId(''); }}>
                <option value="BACKLOG">Pendentes voltam ao backlog</option>
                <option value="SPRINT">Pendentes vão para outra sprint</option>
              </select>
              {pendingDestination === 'SPRINT' && <select className={styles.select} value={targetSprintId} onChange={(event) => setTargetSprintId(event.target.value)}>
                <option value="">Selecione a sprint planejada</option>
                {sprints.filter((sprint) => sprint.id !== selectedSprint.id && sprint.status === 'PLANNED').map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
              </select>}
            </div>}

            <div className={styles.statusActions}>
              <button
                className={styles.secondaryButton}
                disabled={!selectedSprint || selectedSprint.status !== 'PLANNED' || updateStatusMutation.isPending}
                onClick={() => updateStatusMutation.mutate('ACTIVE')}
              >
                Iniciar
              </button>
              <button
                className={styles.secondaryButton}
                disabled={!selectedSprint || selectedSprint.status !== 'ACTIVE' || updateStatusMutation.isPending || (pendingDestination === 'SPRINT' && !targetSprintId)}
                onClick={() => updateStatusMutation.mutate('FINISHED')}
              >
                Concluir
              </button>
              <button
                className={styles.secondaryButton}
                disabled={!selectedSprint || !['PLANNED', 'ACTIVE'].includes(selectedSprint.status) || updateStatusMutation.isPending}
                onClick={() => { if (window.confirm('Cancelar a sprint e devolver seus itens ao backlog?')) updateStatusMutation.mutate('CANCELLED'); }}
              >Cancelar</button>
            </div>
          </section>

          <div className={styles.planningFilters}>
            <select className={styles.select} value={epicFilter} onChange={(event) => setEpicFilter(event.target.value)}>
              <option value="">Todos os épicos</option>
              {epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.project_key} · {epic.title}</option>)}
            </select>
            <select className={styles.select} value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
              <option value="">Todos os responsáveis</option>
              {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.user?.name || member.user_id}</option>)}
            </select>
          </div>

          <div className={styles.planningGrid}>
            <section className={styles.listPanel} onDragOver={(event) => event.preventDefault()} onDrop={() => {
              if (draggedStory?.sprint_id === selectedSprintId && canPlanStories) moveStoryMutation.mutate({ story: draggedStory, destination: 'BACKLOG' });
            }}>
              <div className={styles.panelHeader}>
                <h2>Backlog de Histórias</h2>
                <span>{filteredBacklogStories.length} histórias · {storyPoints(filteredBacklogStories)} pontos</span>
              </div>
              <div className={styles.storyList}>
                {filteredBacklogStories.length === 0 ? (
                  <div className={styles.emptyState}>Não há histórias livres no backlog.</div>
                ) : filteredBacklogStories.map((story) => (
                  <StoryRow
                    key={story.id}
                    story={story}
                    checked={selectedBacklogStoryIds.includes(story.id)}
                    disabled={!canPlanStories}
                    onToggle={toggleBacklogStory}
                    onDragStart={setDraggedStory}
                  />
                ))}
              </div>
              <button
                className="btn-primary"
                disabled={!canPlanStories || selectedBacklogStoryIds.length === 0 || assignStoriesMutation.isPending}
                onClick={() => assignStoriesMutation.mutate()}
              >
                Associar à Sprint
              </button>
            </section>

            <section className={styles.listPanel} onDragOver={(event) => event.preventDefault()} onDrop={() => {
              if (draggedStory && !draggedStory.sprint_id && canPlanStories) moveStoryMutation.mutate({ story: draggedStory, destination: 'SPRINT' });
            }}>
              <div className={styles.panelHeader}>
                <h2>Histórias da Sprint</h2>
                <span>{filteredSprintStories.length} histórias · {storyPoints(filteredSprintStories)} pontos</span>
              </div>
              <div className={styles.storyList}>
                {!selectedSprint ? (
                  <div className={styles.emptyState}>Selecione ou crie uma sprint.</div>
                ) : filteredSprintStories.length === 0 ? (
                  <div className={styles.emptyState}>Nenhuma história associada a esta sprint.</div>
                ) : filteredSprintStories.map((story) => (
                  <StoryRow
                    key={story.id}
                    story={story}
                    checked={selectedSprintStoryIds.includes(story.id)}
                    disabled={!canPlanStories}
                    onToggle={toggleSprintStory}
                    onDragStart={setDraggedStory}
                  />
                ))}
              </div>
              <button
                className={styles.secondaryButton}
                disabled={!canPlanStories || selectedSprintStoryIds.length === 0 || removeStoriesMutation.isPending}
                onClick={() => removeStoriesMutation.mutate()}
              >
                Remover da Sprint
              </button>
            </section>
          </div>

          <SprintMetricsPanel metrics={metricsQuery.data} velocity={velocityQuery.data} loading={metricsQuery.isLoading || velocityQuery.isLoading} />

          {otherSprintStories.length > 0 && (
            <div className={styles.note}>
              {otherSprintStories.length} histórias já estão associadas a outras sprints deste projeto.
            </div>
          )}
        </>
      )}
    </div>
  );
}

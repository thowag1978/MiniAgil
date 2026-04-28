'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '@/lib/api/items';
import { projectsApi } from '@/lib/api/projects';
import { sprintsApi } from '@/lib/api/sprints';
import { queryKeys } from '@/lib/query/keys';
import type { Item, Sprint, SprintStatus } from '@/lib/types';
import styles from './sprint.module.css';

const statusLabel: Record<SprintStatus, string> = {
  PLANNED: 'Planejada',
  ACTIVE: 'Ativa',
  CLOSED: 'Concluída',
};

function formatDate(value?: string | null) {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleDateString('pt-BR');
}

function storyPoints(stories: Item[]) {
  return stories.reduce((total, story) => total + (story.estimate || 0), 0);
}

function StoryRow({
  story,
  checked,
  disabled,
  onToggle,
}: {
  story: Item;
  checked: boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label className={`${styles.storyRow} ${disabled ? styles.storyRowDisabled : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(story.id)}
      />
      <span className={styles.storyKey}>{story.project_key}</span>
      <span className={styles.storyTitle}>{story.title}</span>
      <span className={styles.storyMeta}>{story.estimate ? `${story.estimate} pts` : 'Sem estimativa'}</span>
    </label>
  );
}

export default function SprintPage() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [selectedBacklogStoryIds, setSelectedBacklogStoryIds] = useState<string[]>([]);
  const [selectedSprintStoryIds, setSelectedSprintStoryIds] = useState<string[]>([]);
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

  useEffect(() => {
    if (!selectedProjectId && projectsQuery.data?.[0]?.id) {
      setSelectedProjectId(projectsQuery.data[0].id);
    }
  }, [projectsQuery.data, selectedProjectId]);

  const sprintsQuery = useQuery({
    queryKey: queryKeys.sprints(selectedProjectId || 'none'),
    queryFn: () => sprintsApi.list(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });

  const storiesQuery = useQuery({
    queryKey: queryKeys.itemsByFilter(`project:${selectedProjectId}:stories`),
    queryFn: () => itemsApi.list({ project_id: selectedProjectId, type: 'STORY' }),
    enabled: Boolean(selectedProjectId),
  });

  const sprints = sprintsQuery.data || [];
  const selectedSprint = sprints.find((sprint) => sprint.id === selectedSprintId) || null;

  useEffect(() => {
    if (!sprints.length) {
      setSelectedSprintId('');
      return;
    }

    if (!selectedSprintId || !sprints.some((sprint) => sprint.id === selectedSprintId)) {
      const activeOrPlanned = sprints.find((sprint) => sprint.status === 'ACTIVE') || sprints.find((sprint) => sprint.status === 'PLANNED') || sprints[0];
      setSelectedSprintId(activeOrPlanned.id);
    }
  }, [selectedSprintId, sprints]);

  useEffect(() => {
    setSelectedBacklogStoryIds([]);
    setSelectedSprintStoryIds([]);
  }, [selectedProjectId, selectedSprintId]);

  const stories = storiesQuery.data || [];
  const backlogStories = useMemo(() => stories.filter((story) => !story.sprint_id), [stories]);
  const sprintStories = useMemo(
    () => stories.filter((story) => story.sprint_id === selectedSprintId),
    [selectedSprintId, stories],
  );
  const otherSprintStories = useMemo(
    () => stories.filter((story) => story.sprint_id && story.sprint_id !== selectedSprintId),
    [selectedSprintId, stories],
  );

  const refreshSprintData = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sprints(selectedProjectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.itemsByFilter(`project:${selectedProjectId}:stories`) });
    queryClient.invalidateQueries({ queryKey: queryKeys.backlogOverview(selectedProjectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.items });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics });
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
      setSelectedSprintId(sprint.id);
      refreshSprintData();
    },
  });

  const assignStoriesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSprintId) return;
      await Promise.all(selectedBacklogStoryIds.map((id) => itemsApi.update(id, { sprint_id: selectedSprintId })));
    },
    onSuccess: () => {
      setSelectedBacklogStoryIds([]);
      refreshSprintData();
    },
  });

  const removeStoriesMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedSprintStoryIds.map((id) => itemsApi.update(id, { sprint_id: null })));
    },
    onSuccess: () => {
      setSelectedSprintStoryIds([]);
      refreshSprintData();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: SprintStatus) => {
      if (!selectedSprintId) throw new Error('Selecione uma sprint.');
      return sprintsApi.updateStatus(selectedSprintId, status);
    },
    onSuccess: refreshSprintData,
  });

  const toggleBacklogStory = (id: string) => {
    setSelectedBacklogStoryIds((current) => current.includes(id) ? current.filter((storyId) => storyId !== id) : [...current, id]);
  };

  const toggleSprintStory = (id: string) => {
    setSelectedSprintStoryIds((current) => current.includes(id) ? current.filter((storyId) => storyId !== id) : [...current, id]);
  };

  const isLoading = projectsQuery.isLoading || sprintsQuery.isLoading || storiesQuery.isLoading;
  const isError = projectsQuery.isError || sprintsQuery.isError || storiesQuery.isError;
  const canPlanStories = Boolean(selectedSprint) && selectedSprint?.status !== 'CLOSED';

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
          onChange={(event) => setSelectedProjectId(event.target.value)}
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
                onChange={(event) => setSelectedSprintId(event.target.value)}
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
                disabled={!selectedSprint || selectedSprint.status === 'CLOSED' || updateStatusMutation.isPending}
                onClick={() => updateStatusMutation.mutate('CLOSED')}
              >
                Concluir
              </button>
            </div>
          </section>

          <div className={styles.planningGrid}>
            <section className={styles.listPanel}>
              <div className={styles.panelHeader}>
                <h2>Backlog de Histórias</h2>
                <span>{backlogStories.length} disponíveis</span>
              </div>
              <div className={styles.storyList}>
                {backlogStories.length === 0 ? (
                  <div className={styles.emptyState}>Não há histórias livres no backlog.</div>
                ) : backlogStories.map((story) => (
                  <StoryRow
                    key={story.id}
                    story={story}
                    checked={selectedBacklogStoryIds.includes(story.id)}
                    disabled={!canPlanStories}
                    onToggle={toggleBacklogStory}
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

            <section className={styles.listPanel}>
              <div className={styles.panelHeader}>
                <h2>Histórias da Sprint</h2>
                <span>{storyPoints(sprintStories)} pontos planejados</span>
              </div>
              <div className={styles.storyList}>
                {!selectedSprint ? (
                  <div className={styles.emptyState}>Selecione ou crie uma sprint.</div>
                ) : sprintStories.length === 0 ? (
                  <div className={styles.emptyState}>Nenhuma história associada a esta sprint.</div>
                ) : sprintStories.map((story) => (
                  <StoryRow
                    key={story.id}
                    story={story}
                    checked={selectedSprintStoryIds.includes(story.id)}
                    disabled={!canPlanStories}
                    onToggle={toggleSprintStory}
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

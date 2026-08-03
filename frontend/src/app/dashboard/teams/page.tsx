'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api/projects';
import { Team, TeamInput, teamsApi } from '@/lib/api/teams';
import { usersApi } from '@/lib/api/users';
import { queryKeys } from '@/lib/query/keys';
import styles from './teams.module.css';

const emptyForm: TeamInput = {
  name: '',
  description: '',
  user_ids: [],
  project_ids: [],
};

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [form, setForm] = useState<TeamInput>(emptyForm);
  const [feedback, setFeedback] = useState('');

  const teamsQuery = useQuery({ queryKey: queryKeys.teams, queryFn: teamsApi.list });
  const usersQuery = useQuery({ queryKey: queryKeys.users, queryFn: usersApi.list });
  const projectsQuery = useQuery({ queryKey: queryKeys.projects, queryFn: projectsApi.list });

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setForm({
      name: team.name,
      description: team.description || '',
      user_ids: team.members.map(({ user }) => user.id),
      project_ids: team.projects.map(({ project }) => project.id),
    });
  };

  const handleNew = () => {
    setEditingTeam(null);
    setForm(emptyForm);
  };

  const saveMutation = useMutation({
    mutationFn: (input: TeamInput) => editingTeam
      ? teamsApi.update(editingTeam.id, input)
      : teamsApi.create(input),
    onSuccess: () => {
      setFeedback(editingTeam ? 'Equipe atualizada com sucesso.' : 'Equipe criada com sucesso.');
      setEditingTeam(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: queryKeys.teams });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: teamsApi.remove,
    onSuccess: () => {
      setFeedback('Equipe excluída com sucesso.');
      setEditingTeam(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.teams });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const toggleId = (field: 'user_ids' | 'project_ids', id: string) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(id)
        ? current[field].filter((selectedId) => selectedId !== id)
        : [...current[field], id],
    }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFeedback('');
    saveMutation.mutate(form);
  };

  const handleDelete = (team: Team) => {
    if (confirm(`Excluir a equipe ${team.name}? Os usuários perderão o acesso concedido por ela.`)) {
      deleteMutation.mutate(team.id);
    }
  };

  const isLoading = teamsQuery.isLoading || usersQuery.isLoading || projectsQuery.isLoading;
  const hasError = teamsQuery.isError || usersQuery.isError || projectsQuery.isError;

  return (
    <div className="animate-fade-in">
      <header className={styles.header}>
        <div>
          <h1>Equipes</h1>
          <p>Organize pessoas e defina os projetos que cada equipe pode acessar.</p>
        </div>
      </header>

      {feedback && <div className={styles.feedback}>{feedback}</div>}

      {isLoading ? (
        <div className={styles.state}>Carregando equipes, usuários e projetos...</div>
      ) : hasError ? (
        <div className={styles.error}>Não foi possível carregar os dados para gestão de equipes.</div>
      ) : (
        <div className={styles.layout}>
          <section className={styles.listPanel}>
            <div className={styles.panelTitle}>
              <div>
                <h2>Equipes cadastradas</h2>
                <span>{teamsQuery.data?.length || 0} equipe(s)</span>
              </div>
              <button className="btn-primary" onClick={handleNew}>+ Nova equipe</button>
            </div>

            <div className={styles.teamList}>
              {(teamsQuery.data || []).length === 0 && (
                <div className={styles.empty}>Nenhuma equipe cadastrada.</div>
              )}
              {(teamsQuery.data || []).map((team) => (
                <article className={styles.teamCard} key={team.id}>
                  <div className={styles.teamHeading}>
                    <div>
                      <h3>{team.name}</h3>
                      <p>{team.description || 'Sem descrição'}</p>
                    </div>
                    <div className={styles.actions}>
                      <button onClick={() => handleEdit(team)}>Editar</button>
                      <button className={styles.danger} onClick={() => handleDelete(team)}>Excluir</button>
                    </div>
                  </div>
                  <div className={styles.summary}>
                    <span>{team.members.length} integrante(s)</span>
                    <span>{team.projects.length} projeto(s)</span>
                  </div>
                  <div className={styles.tags}>
                    {team.projects.map(({ project }) => (
                      <span key={project.id}>{project.key_prefix} · {project.name}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <form className={styles.formPanel} onSubmit={handleSubmit}>
            <div className={styles.panelTitle}>
              <div>
                <h2>{editingTeam ? 'Editar equipe' : 'Nova equipe'}</h2>
                <span>Uma pessoa pode participar de várias equipes.</span>
              </div>
            </div>

            <label className={styles.field}>
              <span>Nome da equipe</span>
              <input
                className="input-glass"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                maxLength={100}
              />
            </label>

            <label className={styles.field}>
              <span>Descrição</span>
              <textarea
                className="input-glass"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
                maxLength={300}
              />
            </label>

            <fieldset className={styles.selection}>
              <legend>Integrantes</legend>
              <div className={styles.options}>
                {(usersQuery.data || []).map((user) => (
                  <label key={user.id}>
                    <input
                      type="checkbox"
                      checked={form.user_ids.includes(user.id)}
                      onChange={() => toggleId('user_ids', user.id)}
                    />
                    <span><strong>{user.name}</strong><small>{user.email}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.selection}>
              <legend>Projetos permitidos</legend>
              <div className={styles.options}>
                {(projectsQuery.data || []).map((project) => (
                  <label key={project.id}>
                    <input
                      type="checkbox"
                      checked={form.project_ids.includes(project.id)}
                      onChange={() => toggleId('project_ids', project.id)}
                    />
                    <span><strong>{project.name}</strong><small>{project.key_prefix}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.formActions}>
              {editingTeam && (
                <button type="button" className={styles.secondary} onClick={handleNew}>
                  Cancelar
                </button>
              )}
              <button className="btn-primary" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : editingTeam ? 'Salvar alterações' : 'Criar equipe'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

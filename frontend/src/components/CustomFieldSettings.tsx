'use client';
import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFieldsApi } from '@/lib/api/customFields';
import { queryKeys } from '@/lib/query/keys';
import type { CustomFieldType, ItemType } from '@/lib/types';
import styles from './workflowSettings.module.css';

const itemTypes: ItemType[] = ['EPIC', 'STORY', 'TASK', 'SUBTASK', 'BUG'];
const fieldTypes: CustomFieldType[] = ['TEXT', 'LONG_TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTISELECT', 'USER', 'URL'];

export default function CustomFieldSettings({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [itemType, setItemType] = useState<ItemType>('TASK');
  const [form, setForm] = useState({ name: '', field_type: 'TEXT' as CustomFieldType, is_required: false, show_on_card: false, use_in_filters: false, options: '' });
  const query = useQuery({ queryKey: queryKeys.customFields(projectId, itemType, true), queryFn: () => customFieldsApi.list(projectId, itemType, true) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'custom-fields'] });
  const create = useMutation({ mutationFn: () => customFieldsApi.create(projectId, { ...form, item_type: itemType, options: form.options.split('\n').map(line => line.trim()).filter(Boolean).map(line => ({ label: line, value: line })) }), onSuccess: () => { setForm({ name: '', field_type: 'TEXT', is_required: false, show_on_card: false, use_in_filters: false, options: '' }); refresh(); } });
  const update = useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof customFieldsApi.update>[2] }) => customFieldsApi.update(projectId, id, input), onSuccess: refresh });
  const selectable = form.field_type === 'SELECT' || form.field_type === 'MULTISELECT';
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate(); };

  return <section className={styles.panel}>
    <div className={styles.heading}><div><h2>Campos personalizados</h2><p>Configure campos independentes para cada tipo de item.</p></div>{!canManage && <span className={styles.readOnly}>Somente leitura</span>}</div>
    <div className={styles.typeTabs}>{itemTypes.map(type => <button type="button" key={type} className={type === itemType ? styles.activeTab : styles.tab} onClick={() => setItemType(type)}>{type}</button>)}</div>
    {query.isLoading ? <div className={styles.state}>Carregando campos...</div> : query.isError ? <div className={styles.error}>Não foi possível carregar os campos.</div> : <div className={styles.statusList}>{query.data?.map(field => <article className={`${styles.statusCard} ${!field.is_active ? styles.inactive : ''}`} key={field.id}>
      <div className={styles.statusFields}><strong>{field.name}</strong><span>{field.field_type}</span><span>Posição {field.position}</span></div>
      <div className={styles.badges}>{field.is_required && <span>Obrigatório</span>}{field.show_on_card && <span>Cartão</span>}{field.use_in_filters && <span>Filtro</span>}{!field.is_active && <span>Inativo</span>}</div>
      {field.options.length > 0 && <small>Opções: {field.options.map(option => option.label).join(', ')}</small>}
      {canManage && <div className={styles.actions}><button type="button" onClick={() => update.mutate({ id: field.id, input: { is_required: !field.is_required } })}>{field.is_required ? 'Opcional' : 'Obrigatório'}</button><button type="button" onClick={() => update.mutate({ id: field.id, input: { show_on_card: !field.show_on_card } })}>Alternar cartão</button><button type="button" onClick={() => update.mutate({ id: field.id, input: { use_in_filters: !field.use_in_filters } })}>Alternar filtro</button><button type="button" className={field.is_active ? styles.danger : undefined} onClick={() => update.mutate({ id: field.id, input: { is_active: !field.is_active } })}>{field.is_active ? 'Desativar' : 'Ativar'}</button></div>}
    </article>)}</div>}
    {canManage && <form className={styles.createForm} onSubmit={submit}><h3>Novo campo para {itemType}</h3><input required placeholder="Nome" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} /><select value={form.field_type} onChange={e => setForm(v => ({ ...v, field_type: e.target.value as CustomFieldType }))}>{fieldTypes.map(type => <option key={type}>{type}</option>)}</select><label><input type="checkbox" checked={form.is_required} onChange={e => setForm(v => ({ ...v, is_required: e.target.checked }))} /> Obrigatório</label><label><input type="checkbox" checked={form.show_on_card} onChange={e => setForm(v => ({ ...v, show_on_card: e.target.checked }))} /> Exibir no cartão</label><label><input type="checkbox" checked={form.use_in_filters} onChange={e => setForm(v => ({ ...v, use_in_filters: e.target.checked }))} /> Usar em filtros</label>{selectable && <textarea required placeholder="Uma opção por linha" value={form.options} onChange={e => setForm(v => ({ ...v, options: e.target.value }))} />}<button className="btn-primary" disabled={create.isPending}>Criar campo</button>{create.isError && <span className={styles.error}>{create.error.message}</span>}</form>}
  </section>;
}

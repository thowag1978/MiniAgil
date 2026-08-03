import type { CustomField, CustomFieldInputValue } from '@/lib/types';

export default function CustomFieldInputs({ fields, values, onChange, readOnly = false }: { fields: CustomField[]; values: Record<string, CustomFieldInputValue>; onChange: (fieldId: string, value: CustomFieldInputValue) => void; readOnly?: boolean }) {
  if (!fields.length) return null;
  const control = (field: CustomField) => {
    const value = values[field.id];
    if (readOnly) {
      if (field.field_type === 'BOOLEAN') return value ? 'Sim' : 'Não';
      if (Array.isArray(value)) return value.map((entry) => field.options.find((option) => option.value === entry)?.label || entry).join(', ');
      if (field.field_type === 'SELECT') return field.options.find((option) => option.value === value)?.label || String(value || '—');
      return String(value ?? '—');
    }
    if (field.field_type === 'LONG_TEXT') return <textarea className="input-glass" rows={3} required={field.is_required} value={String(value || '')} onChange={(e) => onChange(field.id, e.target.value)} />;
    if (field.field_type === 'BOOLEAN') return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(field.id, e.target.checked)} />;
    if (field.field_type === 'SELECT') return <select className="input-glass" required={field.is_required} value={String(value || '')} onChange={(e) => onChange(field.id, e.target.value)}><option value="">Selecione...</option>{field.options.filter(o => o.is_active).map(o => <option key={o.id} value={o.value}>{o.label}</option>)}</select>;
    if (field.field_type === 'MULTISELECT') return <select className="input-glass" multiple required={field.is_required} value={Array.isArray(value) ? value : []} onChange={(e) => onChange(field.id, Array.from(e.target.selectedOptions, o => o.value))}>{field.options.filter(o => o.is_active).map(o => <option key={o.id} value={o.value}>{o.label}</option>)}</select>;
    const inputType = field.field_type === 'NUMBER' ? 'number' : field.field_type === 'DATE' ? 'date' : field.field_type === 'URL' ? 'url' : 'text';
    return <input className="input-glass" type={inputType} required={field.is_required} value={value === null || value === undefined ? '' : String(value)} onChange={(e) => onChange(field.id, field.field_type === 'NUMBER' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)} />;
  };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, border: '1px solid var(--border-color)', borderRadius: 8 }}><strong>Campos personalizados</strong>{fields.map(field => <label key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{field.name}{field.is_required ? ' *' : ''}{control(field)}</label>)}</div>;
}

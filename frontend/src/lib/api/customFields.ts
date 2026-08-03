import { apiRequest } from './client';
import type { CustomField, CustomFieldType, ItemType } from '@/lib/types';
export const customFieldsApi = {
  list(projectId: string, itemType: ItemType, includeInactive = false) { return apiRequest<CustomField[]>(`/api/projects/${projectId}/custom-fields?item_type=${itemType}${includeInactive ? '&include_inactive=true' : ''}`); },
  create(projectId: string, input: { name: string; item_type: ItemType; field_type: CustomFieldType; is_required?: boolean; show_on_card?: boolean; use_in_filters?: boolean; options?: Array<{ label: string; value: string }> }) { return apiRequest<CustomField>(`/api/projects/${projectId}/custom-fields`, { method: 'POST', body: JSON.stringify(input) }); },
  update(projectId: string, fieldId: string, input: Partial<Pick<CustomField, 'name' | 'position' | 'is_required' | 'is_active' | 'show_on_card' | 'use_in_filters'>>) { return apiRequest<CustomField>(`/api/projects/${projectId}/custom-fields/${fieldId}`, { method: 'PATCH', body: JSON.stringify(input) }); },
};

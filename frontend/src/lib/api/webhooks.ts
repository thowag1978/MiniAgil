import { apiRequest } from './client';
export const WEBHOOK_EVENTS = ['ITEM_CREATED','ITEM_UPDATED','ITEM_STATUS_CHANGED','ITEM_ASSIGNED','COMMENT_CREATED','ATTACHMENT_CREATED','BUG_CREATED','BUG_REOPENED','SPRINT_STARTED','SPRINT_FINISHED'] as const;
export interface ProjectWebhook { id:string; project_id:string; name:string; url:string; events:string[]; is_active:boolean; createdAt:string; _count?:{deliveries:number}; secret?:string }
export interface WebhookDelivery { id:string; webhook_id:string; event_type:string; status:'PENDING'|'PROCESSING'|'SUCCEEDED'|'RETRYING'|'FAILED'; attempt_count:number; response_status?:number|null; response_body?:string|null; last_error?:string|null; nextAttemptAt?:string|null; createdAt:string; webhook:{name:string} }
export const webhooksApi = {
  list:(projectId:string)=>apiRequest<ProjectWebhook[]>(`/api/projects/${projectId}/webhooks`),
  create:(projectId:string,input:{name:string;url:string;events:string[]})=>apiRequest<ProjectWebhook>(`/api/projects/${projectId}/webhooks`,{method:'POST',body:JSON.stringify(input)}),
  update:(projectId:string,id:string,input:Partial<ProjectWebhook>)=>apiRequest<ProjectWebhook>(`/api/projects/${projectId}/webhooks/${id}`,{method:'PATCH',body:JSON.stringify(input)}),
  test:(projectId:string,id:string)=>apiRequest(`/api/projects/${projectId}/webhooks/${id}/test`,{method:'POST'}),
  deliveries:(projectId:string)=>apiRequest<WebhookDelivery[]>(`/api/projects/${projectId}/webhooks/deliveries/log`),
  retry:(projectId:string,id:string)=>apiRequest(`/api/projects/${projectId}/webhooks/deliveries/${id}/retry`,{method:'POST'}),
};

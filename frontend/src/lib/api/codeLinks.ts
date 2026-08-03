import { apiRequest } from './client';
export type CodeLinkType='ISSUE'|'PULL_REQUEST'|'COMMIT'|'BRANCH';
export interface ProjectRepository{id:string;project_id:string;owner:string;repository:string;default_branch:string;createdAt:string}
export interface ItemCodeLink{id:string;item_id:string;repository_id:string;link_type:CodeLinkType;external_number?:number|null;url:string;branch?:string|null;state?:string|null;createdAt:string;repository:ProjectRepository;createdBy:{id:string;name:string}}
export const codeLinksApi={
 repositories:(projectId:string)=>apiRequest<ProjectRepository[]>(`/api/projects/${projectId}/repositories`),
 createRepository:(projectId:string,input:{owner:string;repository:string;default_branch:string})=>apiRequest<ProjectRepository>(`/api/projects/${projectId}/repositories`,{method:'POST',body:JSON.stringify(input)}),
 list:(itemId:string)=>apiRequest<ItemCodeLink[]>(`/api/items/${itemId}/code-links`),
 create:(itemId:string,input:{repository_id:string;type:CodeLinkType;external_number?:number;url:string;branch?:string;state?:string})=>apiRequest<ItemCodeLink>(`/api/items/${itemId}/code-links`,{method:'POST',body:JSON.stringify(input)}),
 remove:(id:string)=>apiRequest<void>(`/api/code-links/${id}`,{method:'DELETE'}),
};

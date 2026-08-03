import { CodeLinkType, Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/db';

export class CodeLinkError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
const slug = /^[A-Za-z0-9_.-]{1,100}$/;
export function parseRepositoryInput(input: { owner: unknown; repository: unknown; default_branch?: unknown }) {
  const owner = String(input.owner || '').trim(); const repository = String(input.repository || '').trim().replace(/\.git$/i, ''); const defaultBranch = String(input.default_branch || 'main').trim();
  if (!slug.test(owner) || !slug.test(repository)) throw new CodeLinkError(400, 'Invalid GitHub owner or repository');
  if (!defaultBranch || defaultBranch.length > 255 || /[\s~^:?*\[\\]/.test(defaultBranch)) throw new CodeLinkError(400, 'Invalid default branch');
  return { owner, repository, default_branch: defaultBranch };
}
export function parseCodeLink(input: { type: unknown; external_number?: unknown; url: unknown; branch?: unknown; state?: unknown }, repository: { owner: string; repository: string }) {
  const type = String(input.type || '').toUpperCase() as CodeLinkType;
  if (!Object.values(CodeLinkType).includes(type)) throw new CodeLinkError(400, 'Invalid code link type');
  let url: URL; try { url = new URL(String(input.url || '')); } catch { throw new CodeLinkError(400, 'Invalid GitHub URL'); }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || url.username || url.password || url.search || url.hash) throw new CodeLinkError(400, 'Code link must be a clean HTTPS github.com URL');
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0]?.toLowerCase() !== repository.owner.toLowerCase() || segments[1]?.toLowerCase() !== repository.repository.toLowerCase()) throw new CodeLinkError(400, 'GitHub URL does not belong to the selected project repository');
  const externalNumber = input.external_number === undefined || input.external_number === null || input.external_number === '' ? null : Number(input.external_number);
  if ((type === 'ISSUE' || type === 'PULL_REQUEST') && (!Number.isSafeInteger(externalNumber) || Number(externalNumber) < 1)) throw new CodeLinkError(400, 'Issue and pull request links require a positive external number');
  const expectedKind = type === 'ISSUE' ? 'issues' : type === 'PULL_REQUEST' ? 'pull' : type === 'COMMIT' ? 'commit' : 'tree';
  if (segments[2] !== expectedKind) throw new CodeLinkError(400, `URL does not match link type ${type}`);
  if ((type === 'ISSUE' || type === 'PULL_REQUEST') && (segments.length !== 4 || Number(segments[3]) !== externalNumber)) throw new CodeLinkError(400, 'URL number must match external_number');
  if (type === 'COMMIT' && (segments.length !== 4 || !/^[a-f0-9]{7,64}$/i.test(segments[3] || ''))) throw new CodeLinkError(400, 'Invalid GitHub commit URL');
  const urlBranch = type === 'BRANCH' ? segments.slice(3).join('/') : null;
  if (type === 'BRANCH' && !urlBranch) throw new CodeLinkError(400, 'Invalid GitHub branch URL');
  const branch = String(input.branch || urlBranch || '').trim() || null; const state = String(input.state || '').trim() || null;
  if (branch && branch.length > 255) throw new CodeLinkError(400, 'Branch is too long'); if (state && state.length > 50) throw new CodeLinkError(400, 'State is too long');
  return { link_type: type, external_number: externalNumber, url: url.toString(), branch, state };
}
export const listRepositories = (projectId: string) => prisma.projectRepository.findMany({ where: { project_id: projectId }, orderBy: [{ owner: 'asc' }, { repository: 'asc' }] });
export async function createRepository(projectId: string, body: any) { const data = parseRepositoryInput(body); return prisma.projectRepository.create({ data: { project_id: projectId, ...data } }); }
const codeLinkInclude = { repository: { select: { id: true, owner: true, repository: true, default_branch: true, project_id: true } }, createdBy: { select: { id: true, name: true } } } as const;
export const listItemCodeLinks = (itemId: string) => prisma.itemCodeLink.findMany({ where: { item_id: itemId }, include: codeLinkInclude, orderBy: { createdAt: 'desc' } });
export async function createItemCodeLink(input: { itemId: string; projectId: string; userId: string; repositoryId: string; body: any }) {
  const repository = await prisma.projectRepository.findFirst({ where: { id: input.repositoryId, project_id: input.projectId } }); if (!repository) throw new CodeLinkError(400, 'Repository does not belong to the item project');
  const data = parseCodeLink(input.body, repository); const duplicate = await prisma.itemCodeLink.findFirst({ where: { item_id: input.itemId, url: data.url }, select: { id: true } }); if (duplicate) throw new CodeLinkError(409, 'This code link is already registered for the item');
  return prisma.itemCodeLink.create({ data: { item_id: input.itemId, repository_id: repository.id, created_by_id: input.userId, ...data }, include: codeLinkInclude });
}
export async function deleteItemCodeLink(id: string, projectId: string) { const link = await prisma.itemCodeLink.findFirst({ where: { id, item: { project_id: projectId } }, select: { id: true } }); if (!link) throw new CodeLinkError(404, 'Code link not found'); await prisma.itemCodeLink.delete({ where: { id } }); }

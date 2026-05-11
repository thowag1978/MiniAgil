import { ProjectRole, Role } from '@prisma/client';
import { prisma } from '../infrastructure/db';

export type ProjectAccessRole = ProjectRole | 'GLOBAL_ADMIN' | null;

const editableProjectRoles: ProjectRole[] = [ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER];
const managerProjectRoles: ProjectRole[] = [ProjectRole.OWNER, ProjectRole.ADMIN];

export async function getProjectRole(userId: string, projectId: string): Promise<ProjectAccessRole> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) return null;
  if (user.role === Role.ADMIN) return 'GLOBAL_ADMIN';

  const membership = await prisma.projectMember.findFirst({
    where: {
      project_id: projectId,
      user_id: userId,
    },
    select: { role: true },
  });

  if (membership) return membership.role;

  const ownedProject = await prisma.project.findFirst({
    where: {
      id: projectId,
      owner_id: userId,
    },
    select: { id: true },
  });

  return ownedProject ? ProjectRole.OWNER : null;
}

export async function isProjectOwnerOrAdmin(userId: string, projectId: string): Promise<boolean> {
  const role = await getProjectRole(userId, projectId);
  return role === 'GLOBAL_ADMIN' || role === ProjectRole.OWNER || role === ProjectRole.ADMIN;
}

export async function canViewProject(userId: string, projectId: string): Promise<boolean> {
  return (await getProjectRole(userId, projectId)) !== null;
}

export async function canCreateItem(userId: string, projectId: string): Promise<boolean> {
  const role = await getProjectRole(userId, projectId);
  return role === 'GLOBAL_ADMIN' || editableProjectRoles.includes(role as ProjectRole);
}

export async function canUpdateItem(userId: string, projectId: string): Promise<boolean> {
  const role = await getProjectRole(userId, projectId);
  return role === 'GLOBAL_ADMIN' || editableProjectRoles.includes(role as ProjectRole);
}

export async function canDeleteItem(userId: string, projectId: string): Promise<boolean> {
  return isProjectOwnerOrAdmin(userId, projectId);
}

export async function canManageProjectMembers(userId: string, projectId: string): Promise<boolean> {
  const role = await getProjectRole(userId, projectId);
  return role === 'GLOBAL_ADMIN' || managerProjectRoles.includes(role as ProjectRole);
}

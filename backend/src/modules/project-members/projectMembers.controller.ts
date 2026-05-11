import { ProjectRole } from '@prisma/client';
import { Response } from 'express';
import { prisma } from '../../infrastructure/db';
import { canManageProjectMembers, canViewProject } from '../../services/permissions';

const allowedRoles = new Set<ProjectRole>([
  ProjectRole.OWNER,
  ProjectRole.ADMIN,
  ProjectRole.MEMBER,
  ProjectRole.VIEWER,
]);

function parseProjectRole(role: unknown): ProjectRole | null {
  if (typeof role !== 'string') return null;
  const normalized = role.toUpperCase().trim() as ProjectRole;
  return allowedRoles.has(normalized) ? normalized : null;
}

export class ProjectMembersController {
  private async isOnlyOwner(memberId: string, projectId: string) {
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, project_id: projectId },
      select: { id: true, role: true },
    });

    if (!member || member.role !== ProjectRole.OWNER) return false;

    const ownerCount = await prisma.projectMember.count({
      where: { project_id: projectId, role: ProjectRole.OWNER },
    });

    return ownerCount <= 1;
  }

  async list(req: any, res: Response) {
    const { projectId } = req.params;

    if (!(await canViewProject(req.user.id, projectId))) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const members = await prisma.projectMember.findMany({
      where: { project_id: projectId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(members);
  }

  async add(req: any, res: Response) {
    const { projectId } = req.params;
    const { user_id, email, role } = req.body;
    const parsedRole = parseProjectRole(role);

    if (!parsedRole) {
      return res.status(400).json({ error: 'Role must be OWNER, ADMIN, MEMBER or VIEWER' });
    }

    if (!(await canManageProjectMembers(req.user.id, projectId))) {
      return res.status(403).json({ error: 'Only project OWNER or ADMIN can manage members' });
    }

    const user = user_id
      ? await prisma.user.findUnique({ where: { id: String(user_id) }, select: { id: true } })
      : email
        ? await prisma.user.findUnique({ where: { email: String(email) }, select: { id: true } })
        : null;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const existing = await prisma.projectMember.findUnique({
      where: {
        user_id_project_id: {
          user_id: user.id,
          project_id: projectId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return res.status(400).json({ error: 'User is already a member of this project' });
    }

    const member = await prisma.projectMember.create({
      data: {
        user_id: user.id,
        project_id: projectId,
        role: parsedRole,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(member);
  }

  async updateRole(req: any, res: Response) {
    const { projectId, memberId } = req.params;
    const parsedRole = parseProjectRole(req.body.role);

    if (!parsedRole) {
      return res.status(400).json({ error: 'Role must be OWNER, ADMIN, MEMBER or VIEWER' });
    }

    if (!(await canManageProjectMembers(req.user.id, projectId))) {
      return res.status(403).json({ error: 'Only project OWNER or ADMIN can manage members' });
    }

    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, project_id: projectId },
      select: { id: true, role: true },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (parsedRole !== ProjectRole.OWNER && (await this.isOnlyOwner(memberId, projectId))) {
      return res.status(400).json({ error: 'Cannot remove the only OWNER from the project' });
    }

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role: parsedRole },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(updated);
  }

  async remove(req: any, res: Response) {
    const { projectId, memberId } = req.params;

    if (!(await canManageProjectMembers(req.user.id, projectId))) {
      return res.status(403).json({ error: 'Only project OWNER or ADMIN can manage members' });
    }

    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, project_id: projectId },
      select: { id: true },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (await this.isOnlyOwner(memberId, projectId)) {
      return res.status(400).json({ error: 'Cannot remove the only OWNER from the project' });
    }

    await prisma.projectMember.delete({ where: { id: memberId } });
    res.status(204).send();
  }
}

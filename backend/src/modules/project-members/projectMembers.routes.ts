import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { ProjectMembersController } from './projectMembers.controller';

export const projectMemberRoutes = Router({ mergeParams: true });
const projectMembersController = new ProjectMembersController();

projectMemberRoutes.use(authenticate);

projectMemberRoutes.get('/', projectMembersController.list.bind(projectMembersController));
projectMemberRoutes.post('/', projectMembersController.add.bind(projectMembersController));
projectMemberRoutes.patch('/:memberId', projectMembersController.updateRole.bind(projectMembersController));
projectMemberRoutes.delete('/:memberId', projectMembersController.remove.bind(projectMembersController));

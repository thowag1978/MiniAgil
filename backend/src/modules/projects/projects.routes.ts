import { Router } from 'express';
import { ProjectsController } from './projects.controller';
import { authenticate } from '../../middlewares/authMiddleware';
import { projectMemberRoutes } from '../project-members/projectMembers.routes';

export const projectRoutes = Router();
const projectsController = new ProjectsController();

// Todas as rotas de projetos exigem autenticação
projectRoutes.use(authenticate);

projectRoutes.post('/', projectsController.create);
projectRoutes.get('/', projectsController.list);
projectRoutes.use('/:projectId/members', projectMemberRoutes);
projectRoutes.get('/:id', projectsController.getById);
projectRoutes.patch('/:id', projectsController.update);

import { Router } from 'express';
import { ProjectsController } from './projects.controller';
import { authenticate } from '../../middlewares/authMiddleware';
import { projectMemberRoutes } from '../project-members/projectMembers.routes';
import { workflowRoutes } from '../workflows/workflows.routes';
import { projectSavedViewRoutes } from '../saved-views/savedViews.routes';
import { customFieldRoutes } from '../custom-fields/customFields.routes';
import { webhookRoutes } from '../webhooks/webhooks.routes';
import { repositoryRoutes } from '../code-links/codeLinks.routes';

export const projectRoutes = Router();
const projectsController = new ProjectsController();

// Todas as rotas de projetos exigem autenticação
projectRoutes.use(authenticate);

projectRoutes.post('/', projectsController.create);
projectRoutes.get('/', projectsController.list);
projectRoutes.use('/:projectId/members', projectMemberRoutes);
projectRoutes.use('/:projectId/workflows', workflowRoutes);
projectRoutes.use('/:projectId/saved-views', projectSavedViewRoutes);
projectRoutes.use('/:projectId/custom-fields', customFieldRoutes);
projectRoutes.use('/:projectId/webhooks', webhookRoutes);
projectRoutes.use('/:projectId/repositories', repositoryRoutes);
projectRoutes.get('/:id', projectsController.getById);
projectRoutes.patch('/:id', projectsController.update);

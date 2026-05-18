import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { BugFeaturesController } from './bugFeatures.controller';
import { BugSystemsController } from './bugSystems.controller';
import { BugsController } from './bugs.controller';

export const bugRoutes = Router();
const bugsController = new BugsController();
const bugFeaturesController = new BugFeaturesController();
const bugSystemsController = new BugSystemsController();

bugRoutes.use(authenticate);

bugRoutes.get('/dashboard', bugsController.dashboard);
bugRoutes.get('/', bugsController.list);
bugRoutes.post('/', bugsController.create);

bugRoutes.get('/systems', bugSystemsController.list);
bugRoutes.post('/systems', bugSystemsController.create);
bugRoutes.patch('/systems/:id', bugSystemsController.update);
bugRoutes.patch('/systems/:id/active', bugSystemsController.updateActive);
bugRoutes.delete('/systems/:id', bugSystemsController.delete);

bugRoutes.get('/features', bugFeaturesController.list);
bugRoutes.post('/features', bugFeaturesController.create);
bugRoutes.patch('/features/:id', bugFeaturesController.update);
bugRoutes.patch('/features/:id/active', bugFeaturesController.updateActive);
bugRoutes.delete('/features/:id', bugFeaturesController.delete);

bugRoutes.get('/:id', bugsController.getById);
bugRoutes.post('/:id/comments', bugsController.addComment);
bugRoutes.patch('/:id/status', bugsController.updateStatus);
bugRoutes.patch('/:id/assignee', bugsController.updateAssignee);
bugRoutes.patch('/:id/priority', bugsController.updatePriority);
bugRoutes.post('/:id/attachments', bugsController.addAttachment);

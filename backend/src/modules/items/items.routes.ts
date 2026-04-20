import { Router } from 'express';
import { ItemsController } from './items.controller';
import { authenticate } from '../../middlewares/authMiddleware';

export const itemRoutes = Router();
const itemsController = new ItemsController();

itemRoutes.use(authenticate);

itemRoutes.post('/', itemsController.create);
itemRoutes.get('/', itemsController.list);
itemRoutes.get('/dashboard-metrics', itemsController.dashboardMetrics);
itemRoutes.get('/backlog-overview', itemsController.backlogOverview);
itemRoutes.get('/hierarchical', itemsController.listHierarchical);
itemRoutes.get('/statuses', itemsController.listStatuses);
itemRoutes.patch('/:id', itemsController.updateField);
itemRoutes.delete('/:id', itemsController.delete);

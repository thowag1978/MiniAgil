import { Router } from 'express';
import { SprintsController } from './sprints.controller';
import { authenticate } from '../../middlewares/authMiddleware';

export const sprintRoutes = Router();
const sprintsController = new SprintsController();

sprintRoutes.use(authenticate);

sprintRoutes.post('/', sprintsController.create);
sprintRoutes.get('/', sprintsController.list);
sprintRoutes.get('/velocity', sprintsController.velocity);
sprintRoutes.get('/:id/metrics', sprintsController.metrics);
sprintRoutes.patch('/:id/status', sprintsController.updateStatus);
sprintRoutes.post('/:id/items/:itemId', sprintsController.addItem);
sprintRoutes.delete('/:id/items/:itemId', sprintsController.removeItem);
